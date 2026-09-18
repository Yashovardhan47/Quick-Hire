from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.core.config import get_settings
from app.models.entities import AgentRun, AuditEvent, CandidateConsent, InterviewSession, Job, UserRole
from app.schemas.api import InterviewResult, InterviewSessionRead, InterviewSubmit
from app.services.interview_engine import NOTICE, public_questions
from app.services.rag_agents import evaluate_interview, prepare_interview


router = APIRouter(prefix="/interviews", tags=["structured mock interviews"])
settings = get_settings()


async def _external_processing_allowed(db: AsyncSession, candidate_id: str) -> bool:
    return (
        await db.scalar(
            select(CandidateConsent).where(
                CandidateConsent.candidate_id == candidate_id,
                CandidateConsent.purpose == "external_model_processing",
                CandidateConsent.granted.is_(True),
            )
        )
    ) is not None


@router.post("/mock/{job_id}", response_model=InterviewSessionRead, status_code=201)
async def create_mock_interview(
    job_id: str,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> InterviewSessionRead:
    job = await db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Published job not found")
    external_allowed = await _external_processing_allowed(db, identity["sub"])
    questions, trace, model_version = await prepare_interview(
        db,
        candidate_id=identity["sub"],
        job=job,
        settings=settings,
        external_processing_allowed=external_allowed,
    )
    session = InterviewSession(
        candidate_id=identity["sub"],
        job_id=job_id,
        questions=questions,
        model_version=model_version,
        input_mode="answer_text_only",
        agent_trace=trace,
    )
    db.add(session)
    await db.flush()
    db.add(
        AgentRun(
            actor_id=identity["sub"],
            workflow="rag_interview_preparation",
            resource_type="interview_session",
            resource_id=session.id,
            trace=trace,
            output={"question_count": len(questions), "decision_authority": "human_recruiter_only"},
            model_version=model_version,
        )
    )
    await db.commit()
    await db.refresh(session)
    return InterviewSessionRead(
        id=session.id,
        job_id=session.job_id,
        status=session.status,
        questions=public_questions(session.questions),
        notice=NOTICE,
        model_version=session.model_version,
    )


@router.post("/{session_id}/submit", response_model=InterviewResult)
async def submit_mock_interview(
    session_id: str,
    payload: InterviewSubmit,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> InterviewResult:
    session = await db.get(InterviewSession, session_id)
    if not session or session.candidate_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Mock interview was already submitted")
    external_allowed = await _external_processing_allowed(db, identity["sub"])
    result, evaluation_trace, evaluation_version = await evaluate_interview(
        questions=session.questions,
        answers=payload.answers,
        settings=settings,
        external_processing_allowed=external_allowed,
    )
    session.answers = payload.answers
    session.status = "completed"
    session.rubric_scores = result["rubric_scores"]
    session.content_feedback = result["feedback"]
    session.agent_trace = [*(session.agent_trace or []), *evaluation_trace]
    session.evaluation_provenance = {
        "evaluation_mode": "external_grounded_llm" if ":local" not in evaluation_version else "local_content_rubric",
        "used_sources": result.get("used_sources", []),
        "answer_input": "text_only",
        "audio_features_available_to_evaluator": False,
    }
    session.model_version = evaluation_version
    db.add(
        AgentRun(
            actor_id=identity["sub"],
            workflow="rag_interview_evaluation",
            resource_type="interview_session",
            resource_id=session.id,
            trace=evaluation_trace,
            output={
                "content_score": result["content_score"],
                "human_review_required": True,
                "used_sources": result.get("used_sources", []),
            },
            model_version=evaluation_version,
        )
    )
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="mock_interview_completed",
            resource_type="interview_session",
            resource_id=session.id,
            details={
                "content_score": result["content_score"],
                "model_version": session.model_version,
                "answer_input": "text_only",
                "audio_features_evaluated": False,
            },
        )
    )
    await db.commit()
    await manager.send(
        identity["sub"],
        {"type": "mock_interview.completed", "session_id": session.id, "content_score": result["content_score"]},
    )
    return InterviewResult(
        id=session.id,
        status=session.status,
        content_score=result["content_score"],
        rubric_scores=session.rubric_scores,
        feedback=session.content_feedback,
        human_review_required=True,
        model_version=session.model_version,
        evaluation_mode=session.evaluation_provenance["evaluation_mode"],
        evidence_citations=[
            citation
            for question in public_questions(session.questions)
            for citation in question.get("evidence_citations", [])
        ][:12],
        agent_trace=session.agent_trace,
    )
