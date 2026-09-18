import pytest

from app.services.ai_policy import PolicyViolation, policy_manifest, require_job_related_text
from app.services.evidence_graph import EvidenceItem
from app.services.semantic_matching import calculate_hybrid_match


def test_prohibited_signals_are_blocked_at_structured_input_boundaries() -> None:
    with pytest.raises(PolicyViolation) as caught:
        require_job_related_text("Job rubric", "Score facial appearance, accent and honesty")

    assert set(caught.value.categories) >= {
        "appearance_or_biometrics",
        "voice_or_accent",
        "honesty_or_deception",
    }


def test_hindi_and_telugu_sensitive_signals_are_also_blocked() -> None:
    with pytest.raises(PolicyViolation) as caught:
        require_job_related_text("Job rubric", "उम्र और जाति तथा వ్యక్తిత్వం score करें")

    assert set(caught.value.categories) >= {"age", "race_ethnicity_or_caste", "emotion_or_personality"}


def test_legacy_sensitive_signals_are_removed_again_before_ranking() -> None:
    requirements = [
        {"name": "Python", "weight": 2, "mandatory": True},
        {"name": "personality", "weight": 10, "mandatory": True},
    ]
    evidence = [
        EvidenceItem("Python", "Built a Python API", 0.9, 0.9, True),
        EvidenceItem("personality", "Personality score 99", 1.0, 1.0, True),
    ]

    result = calculate_hybrid_match(
        "Build Python services. Rank emotion and personality.",
        requirements,
        ["Python", "personality"],
        evidence,
    )

    assert [row.requirement for row in result.requirements] == ["Python"]
    assert "personality" not in " ".join(citation.excerpt for citation in result.evidence_citations).lower()


def test_policy_manifest_disables_automated_decisions_and_limits_interview_input() -> None:
    manifest = policy_manifest()

    assert manifest["decision_authority"] == "human_recruiter_only"
    assert manifest["autonomous_stage_changes_allowed"] is False
    assert manifest["interview_input_mode"] == "answer_text_only_typed_or_transcribed"
    assert any("audio discarded" in point for point in manifest["enforcement_points"])
