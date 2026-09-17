from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_roles
from app.api.routes.matching import compute_match, refresh_candidate_matches
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import AssessmentAttempt, AuditEvent, CandidateEvidence, Job, UserRole, utcnow
from app.schemas.api import AssessmentAttemptRead, AssessmentResult, AssessmentSubmit
from app.services.assessment_engine import MODEL_VERSION, build_assessment, public_questions, score_assessment
from app.services.evidence_graph import normalize


router = APIRouter(prefix="/assessments", tags=["adaptive assessments"])


@router.post("/adaptive/{job_id}", response_model=AssessmentAttemptRead, status_code=201)
async def create_adaptive_assessment(
    job_id: str,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentAttemptRead:
    job = await db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Published job not found")
    match = await compute_match(job_id, identity["sub"], db)
    coverage = {normalize(item.requirement): item.coverage for item in match.requirements}
    questions = build_assessment(job.requirements, coverage)
    attempt = AssessmentAttempt(
        candidate_id=identity["sub"],
        job_id=job_id,
        questions=questions,
        model_version=MODEL_VERSION,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return AssessmentAttemptRead(
        id=attempt.id,
        job_id=attempt.job_id,
        status=attempt.status,
        questions=public_questions(attempt.questions),
        model_version=attempt.model_version,
        started_at=attempt.started_at,
    )


@router.post("/{attempt_id}/submit", response_model=AssessmentResult)
async def submit_assessment(
    attempt_id: str,
    payload: AssessmentSubmit,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResult:
    attempt = await db.get(AssessmentAttempt, attempt_id)
    if not attempt or attempt.candidate_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Assessment attempt not found")
    if attempt.status == "completed":
        raise HTTPException(status_code=409, detail="Assessment was already submitted")
    result = score_assessment(attempt.questions, payload.answers)
    attempt.answers = payload.answers
    attempt.status = "completed"
    attempt.score = result["score"]
    attempt.competency_scores = result["competency_scores"]
    attempt.feedback = result["feedback"]
    attempt.integrity_flags = result["integrity_flags"]
    attempt.completed_at = utcnow()
    for competency, score in result["competency_scores"].items():
        db.add(
            CandidateEvidence(
                candidate_id=identity["sub"],
                skill=competency,
                source_type="assessment",
                description=f"Objective QuickHire assessment {attempt.id}: {score * 100:.0f}% for {competency}.",
                strength=score,
                confidence=0.9,
                verified=True,
                source_uri=f"assessment:{attempt.id}",
            )
        )
    refreshed = await refresh_candidate_matches(identity["sub"], db)
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="assessment_completed",
            resource_type="assessment_attempt",
            resource_id=attempt.id,
            details={
                "score": attempt.score,
                "applications_refreshed": len(refreshed),
                "model_version": attempt.model_version,
            },
        )
    )
    await db.commit()
    await manager.send(identity["sub"], {"type": "assessment.completed", "attempt_id": attempt.id, "score": attempt.score})
    return AssessmentResult(
        id=attempt.id,
        status=attempt.status,
        score=attempt.score or 0.0,
        competency_scores=attempt.competency_scores,
        feedback=attempt.feedback,
        integrity_flags=attempt.integrity_flags,
        completed_at=attempt.completed_at,
        model_version=attempt.model_version,
    )
