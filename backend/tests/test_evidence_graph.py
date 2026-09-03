from app.services.evidence_graph import EvidenceItem, calculate_match


def test_verified_evidence_outweighs_unverified_profile_claim() -> None:
    requirements = [
        {"name": "Python", "weight": 3, "mandatory": True},
        {"name": "SQL", "weight": 2, "mandatory": True},
    ]
    result = calculate_match(
        requirements,
        profile_skills=["Python", "SQL"],
        evidence_items=[
            EvidenceItem("Python", "Passed Python assessment", 0.95, 0.95, True),
            EvidenceItem("SQL", "Built analytics project", 0.85, 0.8, True),
        ],
    )
    assert result.score >= 80
    assert result.confidence >= 0.8
    assert result.recommendation == "verified_fit"


def test_mandatory_missing_requires_evidence() -> None:
    result = calculate_match(
        [{"name": "PostgreSQL", "weight": 1, "mandatory": True}],
        profile_skills=["HTML"],
        evidence_items=[],
    )
    assert result.recommendation == "evidence_missing"
    assert "PostgreSQL" in result.missing_requirements

