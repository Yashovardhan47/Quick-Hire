from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import AgentRun, Application, AuditEvent, Job, UserRole
from app.schemas.api import (
    CopilotCandidateMatch,
    RecruiterAssistantRequest,
    RecruiterAssistantResponse,
    RecruiterCopilotChatRequest,
    RecruiterCopilotChatResponse,
)
from app.services.recruiter_copilot import (
    MODEL_VERSION as COPILOT_MODEL_VERSION,
    answer_for_plan,
    execute_read_only_plan,
    interpret_intent,
)


router = APIRouter(prefix="/recruiter-assistant", tags=["recruiter assistance"])
settings = get_settings()


def _text_list(value) -> list[str]:
    return [str(item).strip() for item in value or [] if str(item).strip()]


@router.post("/jobs/{job_id}", response_model=RecruiterAssistantResponse)
async def assist_recruiter(
    job_id: str,
    payload: RecruiterAssistantRequest,
    identity: dict = Depends(require_verified_roles(UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> RecruiterAssistantResponse:
    job = await db.get(Job, job_id)
    if job is None or job.recruiter_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Job not found")
    applications = list(await db.scalars(select(Application).where(Application.job_id == job.id)))
    selected = None
    if payload.application_id:
        selected = next((item for item in applications if item.id == payload.application_id), None)
        if selected is None:
            raise HTTPException(status_code=404, detail="Application not found")
    if payload.action != "queue_summary" and selected is None:
        raise HTTPException(status_code=422, detail="Choose an application for this assistant action")

    warnings = [
        "This output is advisory and cannot change an application stage.",
        "Review the cited job-related evidence and record your own reason before any decision.",
    ]
    if payload.action == "queue_summary":
        counts = Counter(item.status.value for item in applications)
        needs_review = sum(1 for item in applications if item.explanation.get("abstained"))
        items = [f"{count} application(s) in {stage.replace('_', ' ')}" for stage, count in sorted(counts.items())]
        if needs_review:
            items.append(f"{needs_review} application(s) have insufficient evidence and must not be inferred as a negative result")
        response = RecruiterAssistantResponse(
            action=payload.action,
            title=f"{job.title} queue brief",
            summary=f"{len(applications)} real application(s) are currently attached to this job.",
            items=items or ["No candidates have applied yet."],
            warnings=warnings,
        )
    else:
        explanation = selected.explanation or {}
        gaps = _text_list(explanation.get("missing_requirements"))
        actions = _text_list(explanation.get("next_best_actions"))
        if payload.action == "evidence_gaps":
            response = RecruiterAssistantResponse(
                action=payload.action,
                title="Evidence review checklist",
                summary="These are missing or weakly supported job requirements, not candidate deficiencies or rejection reasons.",
                items=(gaps or ["No explicit evidence gaps were calculated."]) + actions[:3],
                warnings=warnings,
            )
        elif payload.action == "interview_plan":
            competencies = gaps[:3] or [str(item.get("name", "job requirement")) for item in job.requirements[:3]]
            response = RecruiterAssistantResponse(
                action=payload.action,
                title="Structured answer-content interview plan",
                summary="Ask every candidate comparable, job-related questions and evaluate only editable answer text against a disclosed rubric.",
                items=[f"Ask for a concrete example demonstrating {skill}; assess relevance, method, and measurable outcome." for skill in competencies],
                warnings=[*warnings, "Never score face, voice, accent, emotion, personality, disability, honesty, or protected traits."],
            )
        else:
            response = RecruiterAssistantResponse(
                action=payload.action,
                title="Candidate update draft",
                summary="A neutral status-update draft for recruiter review and sending through QuickHire messages.",
                items=[
                    f"Thank you for your application to {job.title} at {job.company}.",
                    "A recruiter is reviewing your job-related evidence and will communicate any next step here.",
                    "You may request clarification, correction, or an accommodation at any time.",
                ],
                warnings=warnings,
            )

    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action=f"recruiter_assistant_{payload.action}",
            resource_type="job",
            resource_id=job.id,
            details={"application_id": payload.application_id, "advisory_only": True},
        )
    )
    await db.commit()
    return response


@router.post("/jobs/{job_id}/chat", response_model=RecruiterCopilotChatResponse)
async def chat_with_recruiter_copilot(
    job_id: str,
    payload: RecruiterCopilotChatRequest,
    identity: dict = Depends(require_verified_roles(UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> RecruiterCopilotChatResponse:
    job = await db.get(Job, job_id)
    if job is None or job.recruiter_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Job not found")
    applications = list(await db.scalars(select(Application).where(Application.job_id == job.id)))
    if payload.application_id and not any(item.id == payload.application_id for item in applications):
        raise HTTPException(status_code=404, detail="Application not found")

    plan, intent_trace = await interpret_intent(payload.message, job, settings)
    rows, evidence_notes = execute_read_only_plan(applications, plan, payload.application_id)
    trace = [
        intent_trace,
        {
            "agent": "evidence_search_agent",
            "status": "completed",
            "detail": "Searched only applications attached to the selected recruiter-owned job.",
            "data": {"authorized_records": len(applications), "returned_records": len(rows)},
        },
        {
            "agent": "review_brief_agent",
            "status": "completed",
            "detail": "Prepared an advisory summary without changing any application stage.",
            "data": {"decision_authority": "human_recruiter_only"},
        },
    ]
    answer = answer_for_plan(job, plan, rows, len(applications))
    warnings = [
        "This copilot can search and summarize authorized job evidence but cannot shortlist, reject, offer, hire, or change a stage.",
        "Fit values are review aids with uncertainty, not eligibility decisions.",
    ]
    db.add(
        AgentRun(
            actor_id=identity["sub"],
            workflow="recruiter_copilot_read_only",
            resource_type="job",
            resource_id=job.id,
            trace=trace,
            output={"intent": plan["intent"], "result_count": len(rows)},
            model_version=COPILOT_MODEL_VERSION,
        )
    )
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="recruiter_copilot_query",
            resource_type="job",
            resource_id=job.id,
            details={"intent": plan["intent"], "result_count": len(rows), "read_only": True},
        )
    )
    await db.commit()
    return RecruiterCopilotChatResponse(
        answer=answer,
        interpreted_intent=plan["intent"],
        candidates=[CopilotCandidateMatch(**row) for row in rows],
        evidence_notes=evidence_notes,
        agent_trace=trace,
        warnings=warnings,
    )
