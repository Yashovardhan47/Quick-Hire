from __future__ import annotations

import json
from pathlib import Path


def _probability(value: float) -> float:
    normalized = value / 100.0 if value > 1 else value
    return max(0.0, min(1.0, normalized))


def fit_histogram_calibrator(records: list[dict], bins: int = 10) -> dict:
    if len(records) < max(20, bins * 2):
        raise ValueError("At least 20 labeled records are required to fit a calibration artifact")
    rows = []
    for index in range(bins):
        lower, upper = index / bins, (index + 1) / bins
        members = [
            record
            for record in records
            if lower <= _probability(float(record["confidence"])) < upper
            or (index == bins - 1 and _probability(float(record["confidence"])) == 1.0)
        ]
        samples = len(members)
        positives = sum(1 for record in members if float(record["label"]) > 0)
        midpoint = (lower + upper) / 2
        # Beta-prior shrinkage avoids 0/1 claims from sparse bins.
        calibrated = (positives + 4 * midpoint) / (samples + 4)
        rows.append(
            {
                "lower": lower,
                "upper": upper,
                "samples": samples,
                "positives": positives,
                "calibrated": round(calibrated, 6),
            }
        )
    return {"type": "histogram_beta", "version": "confidence-calibration-0.5.0", "bins": rows, "records": len(records)}


def calibrate_probability(raw: float, artifact: dict) -> float:
    probability = _probability(raw)
    for index, row in enumerate(artifact.get("bins", [])):
        lower, upper = float(row["lower"]), float(row["upper"])
        if lower <= probability < upper or (index == len(artifact["bins"]) - 1 and probability == 1.0):
            return max(0.0, min(1.0, float(row["calibrated"])))
    raise ValueError("Calibration artifact does not cover the supplied probability")


def load_calibration_artifact(path: str | None) -> dict | None:
    if not path:
        return None
    artifact = json.loads(Path(path).read_text(encoding="utf-8"))
    if artifact.get("type") != "histogram_beta" or not artifact.get("bins"):
        raise ValueError("Unsupported or empty confidence calibration artifact")
    return artifact
