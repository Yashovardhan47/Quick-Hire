import json
import re
from dataclasses import replace
from typing import Any, Iterable, TypeVar


POLICY_VERSION = "employment-ai-guardrails-0.6.0"
DECISION_AUTHORITY = "human_recruiter_only"
INTERVIEW_INPUT_MODE = "answer_text_only_typed_or_transcribed"

PROHIBITED_SIGNAL_PATTERNS: dict[str, tuple[str, ...]] = {
    "appearance_or_biometrics": (
        r"\bappearance\b", r"\bphoto(?:graph)?s?\b", r"\b(?:face|facial)\b", r"\beye contact\b",
        r"\bbody language\b", r"\bbiometric(?:s)?\b", r"\bskin tone\b", r"चेहरा", r"रूप",
        r"ముఖం", r"రూపం",
    ),
    "voice_or_accent": (
        r"\bvoice\b", r"\baccent\b", r"\bspeech pattern\b", r"\bvocal\b", r"आवाज़|आवाज",
        r"उच्चारण", r"స్వరం", r"యాస",
    ),
    "emotion_or_personality": (
        r"\bemotion(?:al|s)?\b", r"\bsentiment\b", r"\bpersonality\b", r"\btemperament\b",
        r"\bculture fit\b", r"\bpsychometric\b", r"भावना|भावनात्मक", r"व्यक्तित्व",
        r"భావోద్వేగం", r"వ్యక్తిత్వం",
    ),
    "honesty_or_deception": (
        r"\bhonest(?:y)?\b", r"\bdishonest(?:y)?\b", r"\bdeception\b", r"\blie detection\b",
        r"\btruthful(?:ness)?\b", r"\bcredibility score\b", r"ईमानदारी", r"నిజాయితీ",
    ),
    "age": (
        r"\bage\b", r"\bdate of birth\b", r"\bDOB\b", r"\byears? old\b", r"\byoung\b",
        r"उम्र|आयु", r"వయస్సు",
    ),
    "sex_gender_or_orientation": (
        r"\bgender\b", r"\bsex\b", r"\bmale\b", r"\bfemale\b", r"\bman\b", r"\bwoman\b",
        r"\bpregnan(?:t|cy)\b", r"\bsexual orientation\b", r"\btransgender\b", r"लिंग|पुरुष|महिला",
        r"లింగం|పురుషుడు|మహిళ",
    ),
    "race_ethnicity_or_caste": (
        r"\brace\b", r"\bethnic(?:ity| origin)\b", r"\bcaste\b", r"\bskin colou?r\b",
        r"जाति|नस्ल", r"కులం|జాతి",
    ),
    "religion_or_belief": (
        r"\breligion\b", r"\breligious\b", r"\bfaith\b", r"\bbeliefs?\b", r"धर्म", r"మతం",
    ),
    "disability_or_health": (
        r"\bdisabilit(?:y|ies)\b", r"\bdisabled\b", r"\bmedical\b", r"\bhealth condition\b",
        r"\bmental health\b", r"\bgenetic\b", r"\bdiagnos(?:is|ed)\b", r"विकलांगता|दिव्यांग|चिकित्सा",
        r"వైకల్యం|దివ్యాంగ|వైద్య",
    ),
    "family_or_marital_status": (
        r"\bmarital status\b", r"\bmarried\b", r"\bsingle parent\b", r"\bfamily status\b",
        r"\bchildren\b", r"वैवाहिक|शादीशुदा|परिवार", r"వివాహ|కుటుంబ",
    ),
    "nationality_or_immigration": (
        r"\bnationality\b", r"\bnational origin\b", r"\bcitizenship\b", r"\bimmigration status\b",
        r"राष्ट्रीयता|नागरिकता", r"జాతీయత|పౌరసత్వం",
    ),
}

_COMPILED = {
    category: tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for category, patterns in PROHIBITED_SIGNAL_PATTERNS.items()
}


class PolicyViolation(ValueError):
    def __init__(self, context: str, categories: list[str]):
        self.context = context
        self.categories = categories
        labels = ", ".join(category.replace("_", " ") for category in categories)
        super().__init__(f"{context} contains prohibited hiring criteria: {labels}")


def prohibited_categories(text: str) -> list[str]:
    return [category for category, patterns in _COMPILED.items() if any(pattern.search(text) for pattern in patterns)]


def require_job_related_text(context: str, *values: str) -> None:
    categories = sorted({category for value in values for category in prohibited_categories(value or "")})
    if categories:
        raise PolicyViolation(context, categories)


def scrub_prohibited_text(text: str) -> tuple[str, list[str]]:
    categories = prohibited_categories(text)
    scrubbed = text
    for category in categories:
        for pattern in _COMPILED[category]:
            scrubbed = pattern.sub("[excluded sensitive signal]", scrubbed)
    return scrubbed, categories


def safe_feature_names(values: Iterable[str]) -> list[str]:
    return [value for value in values if value.strip() and not prohibited_categories(value)]


def safe_requirements(requirements: Iterable[dict]) -> list[dict]:
    return [item for item in requirements if not prohibited_categories(str(item.get("name", "")))]


def require_safe_preferences(preferences: dict[str, Any]) -> None:
    require_job_related_text("Candidate ranking preferences", json.dumps(preferences, ensure_ascii=False, default=str))


EvidenceT = TypeVar("EvidenceT")


def safe_evidence_items(items: Iterable[EvidenceT]) -> list[EvidenceT]:
    safe = []
    for item in items:
        skill = str(getattr(item, "skill", ""))
        if prohibited_categories(skill):
            continue
        description, _ = scrub_prohibited_text(str(getattr(item, "description", "")))
        try:
            safe.append(replace(item, description=description))
        except TypeError:
            safe.append(item)
    return safe


def policy_manifest() -> dict:
    return {
        "version": POLICY_VERSION,
        "decision_authority": DECISION_AUTHORITY,
        "interview_input_mode": INTERVIEW_INPUT_MODE,
        "autonomous_stage_changes_allowed": False,
        "prohibited_signal_categories": list(PROHIBITED_SIGNAL_PATTERNS),
        "enforcement_points": [
            "job creation",
            "candidate ranking profile",
            "candidate evidence",
            "assessment and interview generation",
            "local and external ranking inputs",
            "recruiter stage confirmation",
            "candidate recourse isolation",
            "revocable candidate consent before external model processing",
            "audio discarded after optional transcription; only editable answer text reaches evaluation",
            "agent tools are advisory and have no application-stage mutation capability",
        ],
    }
