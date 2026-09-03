from app.services.assessment_engine import build_assessment, public_questions, score_assessment


def test_adaptive_assessment_prioritizes_low_coverage_requirement() -> None:
    requirements = [
        {"name": "Python", "weight": 2, "mandatory": True},
        {"name": "SQL", "weight": 1, "mandatory": False},
    ]
    questions = build_assessment(requirements, {"python": 0.8, "sql": 0.1})

    assert questions[0]["competency"] == "SQL"
    assert "answer" not in public_questions(questions)[0]


def test_assessment_scores_only_objective_questions() -> None:
    questions = build_assessment([{"name": "SQL", "weight": 1, "mandatory": True}])
    result = score_assessment(questions, {questions[0]["id"]: "LEFT JOIN"})

    assert result["score"] == 100.0
    assert result["competency_scores"]["SQL"] == 1.0
    assert result["integrity_flags"] == []
