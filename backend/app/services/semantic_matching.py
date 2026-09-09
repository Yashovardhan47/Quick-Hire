import hashlib
import math
import re
import unicodedata
from collections.abc import Iterable

import httpx

from app.schemas.api import EvidenceCitation, MatchResult
from app.services.evidence_graph import EvidenceItem, calculate_match, skill_similarity
from app.services.model_providers import cross_encoder_score, embedding_similarity
from app.services.talent_intelligence import SKILL_TAXONOMY


MODEL_VERSION = "evidencegraph-hybrid-0.3.0"
VECTOR_DIMENSIONS = 384


def _tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).lower()
    tokens = re.findall(r"[^\W_]+(?:[+#.]*)", normalized, flags=re.UNICODE)
    canonical = []
    for skill, aliases in SKILL_TAXONOMY.items():
        if any(alias.lower() in normalized for alias in aliases):
            canonical.extend(re.findall(r"[a-z0-9]+", skill.lower()))
    return [*tokens, *canonical]


def feature_hash_embedding(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    tokens = _tokens(text)
    features = [*tokens, *(f"{left}::{right}" for left, right in zip(tokens, tokens[1:]))]
    vector = [0.0] * dimensions
    for feature in features:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big")
        index = value % dimensions
        vector[index] += -1.0 if value & 1 else 1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right))))


def _candidate_text(profile_skills: Iterable[str], evidence: list[EvidenceItem]) -> str:
    evidence_text = " ".join(f"{item.skill}: {item.description}" for item in evidence)
    return f"Skills: {' '.join(profile_skills)}. Evidence: {evidence_text}"


def _job_text(description: str, requirements: list[dict]) -> str:
    requirement_text = " ".join(str(item.get("name", "")) for item in requirements)
    return f"Requirements: {requirement_text}. Responsibilities: {description}"


def _citations(requirements: list[dict], evidence: list[EvidenceItem]) -> list[EvidenceCitation]:
    citations = []
    for requirement in requirements:
        name = str(requirement.get("name", ""))
        ranked = sorted(
            (
                (skill_similarity(name, item.skill) * item.strength, item)
                for item in evidence
                if skill_similarity(name, item.skill) > 0
            ),
            key=lambda pair: pair[0],
            reverse=True,
        )
        for score, item in ranked[:2]:
            if score < 0.25:
                continue
            citations.append(
                EvidenceCitation(
                    requirement=name,
                    source_uri=item.source_uri or f"evidence:{item.skill.lower().replace(' ', '-')}",
                    excerpt=item.description[:240],
                    verified=item.verified,
                )
            )
    return citations[:12]


def calculate_hybrid_match(
    job_description: str,
    requirements: list[dict],
    profile_skills: Iterable[str],
    evidence_items: Iterable[EvidenceItem],
    semantic_override: float | None = None,
    reranker_override: float | None = None,
    retrieval_mode: str = "local_multilingual_feature_hash",
) -> MatchResult:
    skills = list(profile_skills)
    evidence = list(evidence_items)
    baseline = calculate_match(requirements, skills, evidence)
    local_semantic = cosine_similarity(
        feature_hash_embedding(_job_text(job_description, requirements)),
        feature_hash_embedding(_candidate_text(skills, evidence)),
    )
    semantic = semantic_override if semantic_override is not None else local_semantic
    mandatory_rows = [row for row in baseline.requirements if row.mandatory]
    mandatory_coverage = (
        sum(row.coverage for row in mandatory_rows) / len(mandatory_rows)
        if mandatory_rows
        else sum(row.coverage for row in baseline.requirements) / max(1, len(baseline.requirements))
    )
    verified_count = sum(1 for item in evidence if item.verified)
    verification_density = min(1.0, verified_count / max(2, len(requirements)))
    structured = baseline.score / 100.0
    local_reranker = 0.55 * structured + 0.2 * semantic + 0.15 * mandatory_coverage + 0.1 * verification_density
    reranker = reranker_override if reranker_override is not None else local_reranker
    hybrid_score = 100.0 * (0.75 * structured + 0.15 * semantic + 0.1 * reranker)

    required_verified = min(2, max(1, len(requirements)))
    if verified_count >= required_verified and baseline.confidence >= 0.65:
        confidence_status = "evidence_backed"
    elif len(evidence) < 2 or baseline.confidence < 0.45:
        confidence_status = "limited_evidence"
    else:
        confidence_status = "uncalibrated"
    abstained = not evidence or baseline.confidence < 0.3
    abstention_reason = "Insufficient job-related evidence for a reliable recommendation." if abstained else None
    confidence = min(0.95, baseline.confidence * (0.9 + 0.1 * verification_density))
    uncertainty = max(6.0, 28.0 * (1.0 - confidence) + (5.0 if confidence_status == "uncalibrated" else 0.0))

    return baseline.model_copy(
        update={
            "score": round(hybrid_score, 1),
            "confidence": round(confidence, 3),
            "score_low": round(max(0.0, hybrid_score - uncertainty), 1),
            "score_high": round(min(100.0, hybrid_score + uncertainty), 1),
            "recommendation": "evidence_missing" if abstained else baseline.recommendation,
            "model_version": MODEL_VERSION,
            "ranking_features": {
                "structured_evidence": round(baseline.score, 1),
                "semantic_similarity": round(semantic * 100.0, 1),
                "cross_feature_reranker": round(reranker * 100.0, 1),
            },
            "retrieval_mode": retrieval_mode,
            "confidence_status": confidence_status,
            "abstained": abstained,
            "abstention_reason": abstention_reason,
            "evidence_citations": _citations(requirements, evidence),
        }
    )


async def calculate_configured_hybrid_match(
    job_description: str,
    requirements: list[dict],
    profile_skills: Iterable[str],
    evidence_items: Iterable[EvidenceItem],
    settings,
) -> MatchResult:
    skills = list(profile_skills)
    evidence = list(evidence_items)
    if not (
        settings.external_model_data_processing_enabled
        and settings.ai_api_key
        and settings.embedding_api_url
        and settings.reranker_api_url
    ):
        return calculate_hybrid_match(job_description, requirements, skills, evidence)

    job_text = _job_text(job_description, requirements)
    candidate_text = _candidate_text(skills, evidence)
    try:
        semantic = await embedding_similarity(
            settings.embedding_api_url,
            settings.embedding_model,
            settings.ai_api_key,
            job_text,
            candidate_text,
            settings.ai_request_timeout_seconds,
        )
        reranker = await cross_encoder_score(
            settings.reranker_api_url,
            settings.reranker_model,
            settings.ai_api_key,
            job_text,
            candidate_text,
            settings.ai_request_timeout_seconds,
        )
    except (httpx.HTTPError, KeyError, TypeError, ValueError, RuntimeError):
        return calculate_hybrid_match(
            job_description,
            requirements,
            skills,
            evidence,
            retrieval_mode="local_fallback_after_provider_error",
        )
    return calculate_hybrid_match(
        job_description,
        requirements,
        skills,
        evidence,
        semantic_override=semantic,
        reranker_override=reranker,
        retrieval_mode="configured_multilingual_embedding_and_cross_encoder",
    )
