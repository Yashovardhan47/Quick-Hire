import pytest

from app.services.confidence_calibration import calibrate_probability, fit_histogram_calibrator


def test_calibrator_requires_a_meaningful_labeled_sample() -> None:
    with pytest.raises(ValueError):
        fit_histogram_calibrator([{"confidence": 0.7, "label": 1}])


def test_fitted_calibrator_returns_a_bounded_probability() -> None:
    records = [
        {"confidence": index / 39, "label": 1 if index >= 22 else 0, "query_id": str(index), "score": index}
        for index in range(40)
    ]
    artifact = fit_histogram_calibrator(records, bins=5)
    value = calibrate_probability(0.8, artifact)
    assert 0 < value < 1
    assert artifact["records"] == 40
