from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles, require_verified_roles
from app.api.routes.matching import refresh_candidate_matches
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateDocument, CandidateEvidence, CandidateProfile, User, UserRole
from app.schemas.api import (
    JobAnalysisRequest,
    JobAnalysisResult,
    ResumeAnalysisRequest,
    ResumeAnalysisResult,
    ResumeDocumentResult,
)
from app.services.document_ingestion import DocumentIngestionError, MODEL_VERSION as INGESTION_VERSION, extract_document
from app.services.malware_scanner import MalwareDetectedError, MalwareScanError, scan_bytes
from app.services.knowledge_retrieval import replace_candidate_chunks
from app.services.talent_intelligence import analyze_job_description, analyze_resume


router = APIRouter(prefix="/intelligence", tags=["talent intelligence"])
settings = get_settings()


async def _persist_resume_analysis(
    db: AsyncSession,
    candidate_id: str,
    result: dict,
    document_id: str | None = None,
) -> None:
    profile = await db.get(CandidateProfile, candidate_id)
    if profile is None:
        profile = CandidateProfile(user_id=candidate_id)
        db.add(profile)
    merged = list(dict.fromkeys([*(profile.skills or []), *(item["skill"] for item in result["skills"])]))
    profile.skills = merged
    if result["experience_years"] is not None:
        profile.experience_years = max(profile.experience_years, result["experience_years"])
    existing_records = list(
        await db.scalars(
            select(CandidateEvidence).where(
                CandidateEvidence.candidate_id == candidate_id,
                CandidateEvidence.source_type == "resume",
            )
        )
    )
    existing_by_skill = {item.skill.casefold(): item for item in existing_records}
    for item in result["skills"]:
        locator = item.get("source_locator")
        source_uri = f"document:{document_id}#{locator}" if document_id and locator else None
        existing = existing_by_skill.get(item["skill"].casefold())
        if existing:
            existing.description = item["evidence_excerpt"]
            existing.confidence = item["confidence"]
            if source_uri:
                existing.source_uri = source_uri
        else:
            db.add(
                CandidateEvidence(
                    candidate_id=candidate_id,
                    skill=item["skill"],
                    source_type="resume",
                    description=item["evidence_excerpt"],
                    strength=0.55,
                    confidence=item["confidence"],
                    verified=False,
                    source_uri=source_uri,
                )
            )


@router.post("/resume/analyze", response_model=ResumeAnalysisResult)
async def resume_analysis(
    payload: ResumeAnalysisRequest,
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = analyze_resume(payload.text)
    if payload.persist_evidence:
        await _persist_resume_analysis(db, identity["sub"], result)
        refreshed = await refresh_candidate_matches(identity["sub"], db)
        db.add(
            AuditEvent(
                actor_id=identity["sub"],
                action="resume_claims_extracted",
                resource_type="candidate_profile",
                resource_id=identity["sub"],
                details={
                    "skill_count": len(result["skills"]),
                    "applications_refreshed": len(refreshed),
                    "model_version": result["model_version"],
                },
            )
        )
        await db.commit()
    return result


@router.post("/resume/upload", response_model=ResumeDocumentResult)
async def upload_resume(
    file: UploadFile = File(...),
    persist_evidence: bool = Form(default=True),
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> ResumeDocumentResult:
    content = await file.read(settings.max_resume_bytes + 1)
    if settings.malware_scan_enabled:
        try:
            await scan_bytes(
                content,
                settings.clamav_host,
                settings.clamav_port,
                settings.malware_scan_timeout_seconds,
            )
        except MalwareDetectedError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except MalwareScanError as exc:
            if settings.malware_scan_required:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        extracted = extract_document(
            file.filename,
            content,
            max_bytes=settings.max_resume_bytes,
            max_pages=settings.max_resume_pages,
            max_characters=settings.max_resume_characters,
        )
    except DocumentIngestionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if settings.reject_scanned_pdf_without_text and "low_text_pdf_ocr_required" in extracted.security_flags:
        raise HTTPException(
            status_code=422,
            detail="This PDF contains too little extractable text. Upload an accessible text PDF, DOCX, or TXT file.",
        )

    if persist_evidence:
        existing = await db.scalar(
            select(CandidateDocument).where(
                CandidateDocument.candidate_id == identity["sub"],
                CandidateDocument.sha256 == extracted.sha256,
            )
        )
        if existing:
            return ResumeDocumentResult(
                document_id=existing.id,
                filename=existing.original_filename,
                media_type=existing.media_type,
                sha256=existing.sha256,
                size_bytes=existing.size_bytes,
                page_count=existing.page_count,
                text_length=existing.text_length,
                language_codes=existing.language_codes,
                security_flags=existing.security_flags,
                duplicate=True,
                retention_notice="Only document metadata, extracted evidence and short provenance excerpts are retained; the raw file is not stored.",
                analysis=existing.analysis,
            )

    result = analyze_resume(extracted.text, extracted.segments)
    if "low_text_pdf_ocr_required" in extracted.security_flags:
        result["quality_warnings"].append("The PDF appears scan-based; OCR is required before its evidence can be complete.")
    document = None
    if persist_evidence:
        document = CandidateDocument(
            candidate_id=identity["sub"],
            original_filename=extracted.filename,
            media_type=extracted.media_type,
            sha256=extracted.sha256,
            size_bytes=extracted.size_bytes,
            text_length=len(extracted.text),
            page_count=extracted.page_count,
            language_codes=result["language_codes"],
            security_flags=extracted.security_flags,
            analysis=result,
            model_version=INGESTION_VERSION,
        )
        db.add(document)
        await db.flush()
        await _persist_resume_analysis(db, identity["sub"], result, document.id)
        candidate = await db.get(User, identity["sub"])
        chunk_count = await replace_candidate_chunks(
            db,
            candidate_id=identity["sub"],
            document_id=document.id,
            segments=extracted.segments,
            redact_terms=(candidate.full_name, candidate.email) if candidate else (),
        )
        refreshed = await refresh_candidate_matches(identity["sub"], db)
        db.add(
            AuditEvent(
                actor_id=identity["sub"],
                action="resume_document_ingested",
                resource_type="candidate_document",
                resource_id=document.id,
                details={
                    "sha256": extracted.sha256,
                    "skill_count": len(result["skills"]),
                    "applications_refreshed": len(refreshed),
                    "security_flags": extracted.security_flags,
                    "knowledge_chunk_count": chunk_count,
                    "model_version": INGESTION_VERSION,
                },
            )
        )
        await db.commit()

    return ResumeDocumentResult(
        document_id=document.id if document else None,
        filename=extracted.filename,
        media_type=extracted.media_type,
        sha256=extracted.sha256,
        size_bytes=extracted.size_bytes,
        page_count=extracted.page_count,
        text_length=len(extracted.text),
        language_codes=result["language_codes"],
        security_flags=extracted.security_flags,
        retention_notice="Only document metadata, extracted evidence and short provenance excerpts are retained; the raw file is not stored.",
        analysis=result,
    )


@router.post("/job-description/analyze", response_model=JobAnalysisResult)
async def job_analysis(
    payload: JobAnalysisRequest,
    _: dict = Depends(require_verified_roles(UserRole.recruiter, UserRole.admin)),
) -> dict:
    return analyze_job_description(payload.title, payload.description)
