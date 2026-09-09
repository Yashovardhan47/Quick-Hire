import re
from collections.abc import Iterable
from dataclasses import dataclass
from difflib import SequenceMatcher

from app.schemas.api import MatchResult, RequirementMatch
from app.services.ai_policy import safe_evidence_items, safe_feature_names, safe_requirements


MODEL_VERSION = "evidencegraph-baseline-0.1.0"


@dataclass(frozen=True)
class EvidenceItem:
    skill: str
    description: str
    strength: float
    confidence: float
    verified: bool = False
    source_uri: str | None = None


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", " ", value.lower()).strip()


def skill_similarity(required: str, observed: str) -> float:
    left, right = normalize(required), normalize(observed)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if left in right or right in left:
        return 0.85
    return SequenceMatcher(None, left, right).ratio() if SequenceMatcher(None, left, right).ratio() >= 0.72 else 0.0


def calculate_match(
    requirements: list[dict],
    profile_skills: Iterable[str],
    evidence_items: Iterable[EvidenceItem],
) -> MatchResult:
    requirements = safe_requirements(requirements)
    profile = [normalize(skill) for skill in safe_feature_names(profile_skills)]
    evidence = safe_evidence_items(evidence_items)
    rows: list[RequirementMatch] = []
    weighted_coverage = 0.0
    weighted_confidence = 0.0
    total_weight = 0.0

    for requirement in requirements:
        name = str(requirement.get("name", "")).strip()
        weight = float(requirement.get("weight", 1.0))
        mandatory = bool(requirement.get("mandatory", False))
        total_weight += weight

        profile_match = max((skill_similarity(name, skill) for skill in profile), default=0.0)
        supporting = []
        best_evidence_score = 0.0
        best_confidence = 0.35 if profile_match else 0.0

        for item in evidence:
            similarity = skill_similarity(name, item.skill)
            if similarity == 0:
                continue
            verification_bonus = 1.0 if item.verified else 0.85
            score = similarity * item.strength * verification_bonus
            if score > 0.25:
                supporting.append(item.description)
            if score > best_evidence_score:
                best_evidence_score = score
                best_confidence = item.confidence * verification_bonus

        coverage = min(1.0, max(profile_match * 0.45, best_evidence_score))
        confidence = min(1.0, best_confidence)
        weighted_coverage += coverage * weight
        weighted_confidence += confidence * weight
        rows.append(
            RequirementMatch(
                requirement=name,
                weight=weight,
                coverage=round(coverage, 3),
                confidence=round(confidence, 3),
                evidence=supporting[:5],
                mandatory=mandatory,
            )
        )

    denominator = total_weight or 1.0
    score = 100 * weighted_coverage / denominator
    confidence = weighted_confidence / denominator
    uncertainty = max(4.0, 20.0 * (1.0 - confidence))
    missing = [row.requirement for row in rows if row.coverage < 0.45]
    mandatory_missing = any(row.mandatory and row.coverage < 0.45 for row in rows)

    if mandatory_missing or confidence < 0.45:
        recommendation = "evidence_missing"
    elif score >= 70 and confidence >= 0.65:
        recommendation = "verified_fit"
    else:
        recommendation = "needs_review"

    actions = [f"Add verified evidence or complete a targeted check for {name}." for name in missing[:3]]
    if not actions and confidence < 0.75:
        actions.append("Verify the strongest resume claims with a project, assessment or structured interview.")

    return MatchResult(
        score=round(score, 1),
        confidence=round(confidence, 3),
        score_low=round(max(0.0, score - uncertainty), 1),
        score_high=round(min(100.0, score + uncertainty), 1),
        recommendation=recommendation,
        requirements=rows,
        missing_requirements=missing,
        next_best_actions=actions,
        model_version=MODEL_VERSION,
    )
