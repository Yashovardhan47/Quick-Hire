from app.services.interview_engine import NOTICE, build_interview, score_interview


def test_interview_uses_disclosed_content_rubric_and_requires_human_review() -> None:
    questions = build_interview([{"name": "Python", "weight": 2, "mandatory": True}])
    answer = (
        "In a customer project, I built a Python validation service because inaccurate records were reaching users. "
        "I chose schema checks, tested alternatives, and reduced failed imports by 35%. I learned that the trade-off "
        "was stricter validation versus faster ingestion, and next time I would measure both metrics."
    )
    result = score_interview(questions, {"q1": answer})

    assert result["content_score"] > 70
    assert result["human_review_required"] is True
    assert "does not analyze face, voice, accent, emotion" in NOTICE
