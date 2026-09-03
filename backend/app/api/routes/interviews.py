from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import AuditEvent, InterviewSession, Job, UserRole
from app.schemas.api import InterviewResult, InterviewSessionRead, InterviewSubmit
from app.services.interview_engine import MODEL_VERSION, NOTICE, build_interview, public_questions, score_interview


router = APIRouter(prefix="/interviews", tags=["structured mock interviews"])


@router.post("/mock/{job_id}", response_model=InterviewSessionRead, status_code=201)
async def create_mock_interview(
    job_id: str,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> InterviewSessionRead:
    job = await db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Published job not found")
    questions = build_interview(job.requirements)
    session = InterviewSession(
        candidate_id=identity["sub"],
        job_id=job_id,
        questions=questions,
        model_version=MODEL_VERSION,
    )
    db.add(session)
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
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> InterviewResult:
    session = await db.get(InterviewSession, session_id)
    if not session or session.candidate_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Mock interview was already submitted")
    result = score_interview(session.questions, payload.answers)
    session.answers = payload.answers
    session.status = "completed"
    session.rubric_scores = result["rubric_scores"]
    session.content_feedback = result["feedback"]
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="mock_interview_completed",
            resource_type="interview_session",
            resource_id=session.id,
            details={"content_score": result["content_score"], "model_version": session.model_version},
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
    )
