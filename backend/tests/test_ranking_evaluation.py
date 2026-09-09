from app.services.ranking_evaluation import evaluate_rankings


def test_ranking_evaluation_reports_relevance_and_calibration_metrics() -> None:
    metrics = evaluate_rankings(
        [
            {"query_id": "job-1", "label": 2, "score": 90, "confidence": 0.8},
            {"query_id": "job-1", "label": 0, "score": 30, "confidence": 0.2},
            {"query_id": "job-2", "label": 1, "score": 70, "confidence": 0.7},
            {"query_id": "job-2", "label": 0, "score": 60, "confidence": 0.4, "abstained": True},
        ]
    )

    assert metrics["ndcg@10"] == 1.0
    assert metrics["mrr"] == 1.0
    assert metrics["recommendation_coverage"] == 0.75
