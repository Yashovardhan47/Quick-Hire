import math
from collections import defaultdict


def _dcg(labels: list[float], limit: int) -> float:
    return sum((2**label - 1) / math.log2(index + 2) for index, label in enumerate(labels[:limit]))


def evaluate_rankings(records: list[dict], k: int = 10, calibration_bins: int = 10) -> dict[str, float | int]:
    if not records:
        raise ValueError("At least one labeled ranking record is required")
    groups: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        groups[str(record["query_id"])].append(record)

    ndcg_values = []
    reciprocal_ranks = []
    for group in groups.values():
        ranked = sorted(group, key=lambda item: float(item["score"]), reverse=True)
        labels = [float(item["label"]) for item in ranked]
        ideal = sorted(labels, reverse=True)
        ideal_dcg = _dcg(ideal, k)
        ndcg_values.append(_dcg(labels, k) / ideal_dcg if ideal_dcg else 0.0)
        first_relevant = next((index for index, label in enumerate(labels, start=1) if label > 0), None)
        reciprocal_ranks.append(1.0 / first_relevant if first_relevant else 0.0)

    probabilities = []
    outcomes = []
    for record in records:
        raw_confidence = float(record.get("confidence", 0.0))
        probabilities.append(max(0.0, min(1.0, raw_confidence / 100.0 if raw_confidence > 1 else raw_confidence)))
        outcomes.append(1.0 if float(record["label"]) > 0 else 0.0)
    brier = sum((probability - outcome) ** 2 for probability, outcome in zip(probabilities, outcomes)) / len(records)

    expected_calibration_error = 0.0
    for bin_index in range(calibration_bins):
        lower = bin_index / calibration_bins
        upper = (bin_index + 1) / calibration_bins
        members = [
            (probability, outcome)
            for probability, outcome in zip(probabilities, outcomes)
            if lower <= probability < upper or (bin_index == calibration_bins - 1 and probability == 1.0)
        ]
        if not members:
            continue
        mean_confidence = sum(item[0] for item in members) / len(members)
        mean_outcome = sum(item[1] for item in members) / len(members)
        expected_calibration_error += len(members) / len(records) * abs(mean_confidence - mean_outcome)

    non_abstained = sum(1 for record in records if not bool(record.get("abstained", False)))
    return {
        "queries": len(groups),
        "records": len(records),
        f"ndcg@{k}": round(sum(ndcg_values) / len(ndcg_values), 4),
        "mrr": round(sum(reciprocal_ranks) / len(reciprocal_ranks), 4),
        "brier_score": round(brier, 4),
        "expected_calibration_error": round(expected_calibration_error, 4),
        "recommendation_coverage": round(non_abstained / len(records), 4),
    }
