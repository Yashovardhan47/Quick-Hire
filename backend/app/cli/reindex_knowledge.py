import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.entities import CandidateDocument, Job, User
from app.services.knowledge_retrieval import replace_candidate_chunks, replace_job_chunks


def _document_segments(document: CandidateDocument) -> list[dict[str, str]]:
    analysis = document.analysis or {}
    segments: list[dict[str, str]] = []
    for index, skill in enumerate(analysis.get("skills", []), start=1):
        excerpt = str(skill.get("evidence_excerpt", "")).strip()
        if excerpt:
            segments.append(
                {
                    "locator": str(skill.get("source_locator") or f"stored-analysis:skill:{index}"),
                    "text": f"{skill.get('skill', 'Skill')}: {excerpt}",
                }
            )
    for group in ("experience_signals", "project_signals", "education_signals"):
        for index, value in enumerate(analysis.get(group, []), start=1):
            if str(value).strip():
                segments.append({"locator": f"stored-analysis:{group}:{index}", "text": str(value)})
    return segments


async def reindex() -> None:
    async with AsyncSessionLocal() as db:
        jobs = list(await db.scalars(select(Job)))
        documents = list(await db.scalars(select(CandidateDocument)))
        job_chunks = 0
        document_chunks = 0
        for job in jobs:
            job_chunks += await replace_job_chunks(
                db,
                job_id=job.id,
                title=job.title,
                description=job.description,
                requirements=job.requirements,
            )
        for document in documents:
            segments = _document_segments(document)
            if segments:
                candidate = await db.get(User, document.candidate_id)
                document_chunks += await replace_candidate_chunks(
                    db,
                    candidate_id=document.candidate_id,
                    document_id=document.id,
                    segments=segments,
                    redact_terms=(candidate.full_name, candidate.email) if candidate else (),
                )
        await db.commit()
        print(f"indexed {job_chunks} job chunks and {document_chunks} retained candidate-evidence chunks")


if __name__ == "__main__":
    asyncio.run(reindex())
