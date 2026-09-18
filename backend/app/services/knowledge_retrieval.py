import hashlib
import re
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import CandidateKnowledgeChunk, JobKnowledgeChunk
from app.services.ai_policy import scrub_prohibited_text
from app.services.semantic_matching import cosine_similarity, feature_hash_embedding
from app.services.talent_intelligence import SKILL_TAXONOMY


MODEL_VERSION = "quickhire-rag-feature-hash-384-v1"
MAX_CHUNK_CHARACTERS = 900
MAX_CHUNKS_PER_DOCUMENT = 100
_INSTRUCTION_PATTERN = re.compile(
    r"ignore (?:all|any|previous) instructions|system prompt|developer message|assistant\s*:|do not follow the rubric",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class RetrievedChunk:
    content: str
    source_uri: str
    similarity: float


def _safe_content(value: str, redact_terms: tuple[str, ...] = ()) -> str:
    scrubbed, _ = scrub_prohibited_text(value)
    scrubbed = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email removed]", scrubbed, flags=re.I)
    scrubbed = re.sub(r"(?<!\d)(?:\+?\d[\s().-]*){10,14}(?!\d)", "[phone removed]", scrubbed)
    scrubbed = _INSTRUCTION_PATTERN.sub("[instruction-like text removed]", scrubbed)
    for term in redact_terms:
        if term and len(term.strip()) >= 2:
            scrubbed = re.sub(re.escape(term.strip()), "[identity removed]", scrubbed, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", scrubbed).strip()


def _job_related_sentence(sentence: str) -> bool:
    lowered = sentence.casefold()
    aliases = (alias.casefold() for values in SKILL_TAXONOMY.values() for alias in values)
    if any(alias in lowered for alias in aliases):
        return True
    return bool(
        re.search(
            r"\b(?:built|developed|designed|implemented|tested|analyzed|managed|led|project|portfolio|experience|education|degree|university|college|result|reduced|improved|increased|delivered)\b|अनुभव|परियोजना|शिक्षा|అనుభవం|ప్రాజెక్ట్|విద్య",
            sentence,
            re.IGNORECASE,
        )
    )


def chunk_segments(
    segments: list[dict[str, str]],
    *,
    job_related_only: bool = False,
    redact_terms: tuple[str, ...] = (),
) -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []
    for segment in segments:
        locator = str(segment.get("locator", "document"))[:120]
        text = _safe_content(str(segment.get("text", "")), redact_terms)
        if not text:
            continue
        sentences = [item.strip() for item in re.split(r"(?<=[.!?।])\s+|\n+", text) if item.strip()]
        if job_related_only:
            sentences = [item for item in sentences if _job_related_sentence(item)]
        current = ""
        part = 1
        for sentence in sentences:
            if len(sentence) > MAX_CHUNK_CHARACTERS:
                sentence_parts = [
                    sentence[index : index + MAX_CHUNK_CHARACTERS]
                    for index in range(0, len(sentence), MAX_CHUNK_CHARACTERS)
                ]
            else:
                sentence_parts = [sentence]
            for sentence_part in sentence_parts:
                candidate = f"{current} {sentence_part}".strip()
                if current and len(candidate) > MAX_CHUNK_CHARACTERS:
                    chunks.append({"locator": f"{locator}:chunk:{part}", "text": current})
                    part += 1
                    current = sentence_part
                else:
                    current = candidate
        if current:
            chunks.append({"locator": f"{locator}:chunk:{part}", "text": current})
        if len(chunks) >= MAX_CHUNKS_PER_DOCUMENT:
            break
    return chunks[:MAX_CHUNKS_PER_DOCUMENT]


def _digest(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def replace_candidate_chunks(
    db: AsyncSession,
    *,
    candidate_id: str,
    document_id: str,
    segments: list[dict[str, str]],
    redact_terms: tuple[str, ...] = (),
) -> int:
    await db.execute(delete(CandidateKnowledgeChunk).where(CandidateKnowledgeChunk.document_id == document_id))
    chunks = chunk_segments(segments, job_related_only=True, redact_terms=redact_terms)
    for chunk in chunks:
        db.add(
            CandidateKnowledgeChunk(
                candidate_id=candidate_id,
                document_id=document_id,
                locator=chunk["locator"],
                content=chunk["text"],
                content_hash=_digest(chunk["text"]),
                embedding=feature_hash_embedding(chunk["text"]),
                model_version=MODEL_VERSION,
            )
        )
    return len(chunks)


def job_segments(title: str, description: str, requirements: list[dict]) -> list[dict[str, str]]:
    rows = [{"locator": "job:description", "text": f"{title}. {description}"}]
    rows.extend(
        {
            "locator": f"job:requirement:{index}",
            "text": (
                f"Requirement: {item.get('name', '')}. Weight: {item.get('weight', 1)}. "
                f"Mandatory: {bool(item.get('mandatory', False))}."
            ),
        }
        for index, item in enumerate(requirements, start=1)
    )
    return rows


async def replace_job_chunks(
    db: AsyncSession,
    *,
    job_id: str,
    title: str,
    description: str,
    requirements: list[dict],
) -> int:
    await db.execute(delete(JobKnowledgeChunk).where(JobKnowledgeChunk.job_id == job_id))
    chunks = chunk_segments(job_segments(title, description, requirements))
    for chunk in chunks:
        db.add(
            JobKnowledgeChunk(
                job_id=job_id,
                locator=chunk["locator"],
                content=chunk["text"],
                content_hash=_digest(chunk["text"]),
                embedding=feature_hash_embedding(chunk["text"]),
                model_version=MODEL_VERSION,
            )
        )
    return len(chunks)


def _is_postgresql(db: AsyncSession) -> bool:
    try:
        return db.get_bind().dialect.name == "postgresql"
    except (AttributeError, RuntimeError):
        return False


async def retrieve_candidate_chunks(
    db: AsyncSession,
    *,
    candidate_id: str,
    query: str,
    limit: int = 6,
) -> list[RetrievedChunk]:
    query_vector = feature_hash_embedding(_safe_content(query))
    if _is_postgresql(db):
        distance = CandidateKnowledgeChunk.embedding.cosine_distance(query_vector)
        rows = list(
            await db.scalars(
                select(CandidateKnowledgeChunk)
                .where(CandidateKnowledgeChunk.candidate_id == candidate_id)
                .order_by(distance)
                .limit(limit)
            )
        )
        return [
            RetrievedChunk(
                content=row.content,
                source_uri=f"document:{row.document_id}#{row.locator}",
                similarity=cosine_similarity(query_vector, list(row.embedding)),
            )
            for row in rows
        ]

    rows = list(
        await db.scalars(
            select(CandidateKnowledgeChunk).where(CandidateKnowledgeChunk.candidate_id == candidate_id)
        )
    )
    ranked = sorted(
        (
            RetrievedChunk(
                content=row.content,
                source_uri=f"document:{row.document_id}#{row.locator}",
                similarity=cosine_similarity(query_vector, list(row.embedding)),
            )
            for row in rows
        ),
        key=lambda item: item.similarity,
        reverse=True,
    )
    return ranked[:limit]


async def retrieve_job_chunks(
    db: AsyncSession,
    *,
    job_id: str,
    query: str,
    limit: int = 4,
) -> list[RetrievedChunk]:
    query_vector = feature_hash_embedding(_safe_content(query))
    if _is_postgresql(db):
        distance = JobKnowledgeChunk.embedding.cosine_distance(query_vector)
        rows = list(
            await db.scalars(
                select(JobKnowledgeChunk)
                .where(JobKnowledgeChunk.job_id == job_id)
                .order_by(distance)
                .limit(limit)
            )
        )
    else:
        source = list(await db.scalars(select(JobKnowledgeChunk).where(JobKnowledgeChunk.job_id == job_id)))
        rows = sorted(
            source,
            key=lambda row: cosine_similarity(query_vector, list(row.embedding)),
            reverse=True,
        )[:limit]
    return [
        RetrievedChunk(
            content=row.content,
            source_uri=f"job:{row.job_id}#{row.locator}",
            similarity=cosine_similarity(query_vector, list(row.embedding)),
        )
        for row in rows
    ]


async def retrieve_job_ids(
    db: AsyncSession,
    *,
    query: str,
    limit: int = 100,
) -> list[str]:
    """Vector preselection for recommendations; final ordering still uses EvidenceGraph."""
    query_vector = feature_hash_embedding(_safe_content(query))
    if _is_postgresql(db):
        distance = JobKnowledgeChunk.embedding.cosine_distance(query_vector)
        rows = (
            await db.execute(
                select(JobKnowledgeChunk.job_id, distance.label("distance"))
                .order_by(distance)
                .limit(max(limit * 4, limit))
            )
        ).all()
        ordered: list[str] = []
        for job_id, _ in rows:
            if job_id not in ordered:
                ordered.append(job_id)
            if len(ordered) >= limit:
                break
        return ordered
    rows = list(await db.scalars(select(JobKnowledgeChunk)))
    ranked = sorted(
        rows,
        key=lambda row: cosine_similarity(query_vector, list(row.embedding)),
        reverse=True,
    )
    ordered = []
    for row in ranked:
        if row.job_id not in ordered:
            ordered.append(row.job_id)
        if len(ordered) >= limit:
            break
    return ordered
