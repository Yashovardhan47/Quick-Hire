from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles, require_verified_roles
from app.api.routes.matching import refresh_candidate_matches
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateConsent, UserRole
from app.schemas.api import CandidateConsentRead, CandidateConsentUpdate
from app.services.ai_policy import POLICY_VERSION


router = APIRouter(prefix="/candidate-consents", tags=["candidate privacy consent"])
PURPOSE = "external_model_processing"


@router.get("/me", response_model=CandidateConsentRead)
async def get_consent(
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateConsentRead:
    consent = await db.scalar(
        select(CandidateConsent).where(
            CandidateConsent.candidate_id == identity["sub"],
            CandidateConsent.purpose == PURPOSE,
        )
    )
    if consent is None:
        return CandidateConsentRead(granted=False, policy_version=POLICY_VERSION)
    return CandidateConsentRead(
        granted=consent.granted,
        policy_version=consent.policy_version,
        updated_at=consent.updated_at,
    )


@router.put("/me", response_model=CandidateConsentRead)
async def update_consent(
    payload: CandidateConsentUpdate,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateConsentRead:
    consent = await db.scalar(
        select(CandidateConsent).where(
            CandidateConsent.candidate_id == identity["sub"],
            CandidateConsent.purpose == PURPOSE,
        )
    )
    if consent is None:
        consent = CandidateConsent(
            candidate_id=identity["sub"],
            purpose=PURPOSE,
            granted=payload.granted,
            policy_version=POLICY_VERSION,
        )
        db.add(consent)
    else:
        consent.granted = payload.granted
        consent.policy_version = POLICY_VERSION
    await db.flush()
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="external_model_consent_updated",
            resource_type="candidate_consent",
            resource_id=consent.id,
            details={"granted": payload.granted, "policy_version": POLICY_VERSION},
        )
    )
    await refresh_candidate_matches(identity["sub"], db)
    await db.commit()
    await db.refresh(consent)
    return CandidateConsentRead(
        granted=consent.granted,
        policy_version=consent.policy_version,
        updated_at=consent.updated_at,
    )
