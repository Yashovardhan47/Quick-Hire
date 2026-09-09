import pytest

from app.models.entities import ApplicationStatus
from app.services.application_workflow import validate_transition


def test_allowed_application_transition() -> None:
    validate_transition(
        ApplicationStatus.applied,
        ApplicationStatus.under_review,
        human_confirmed=True,
        evidence_reviewed=True,
    )


def test_skipping_required_stage_is_blocked() -> None:
    with pytest.raises(ValueError, match="not allowed"):
        validate_transition(
            ApplicationStatus.applied,
            ApplicationStatus.hired,
            human_confirmed=True,
            evidence_reviewed=True,
        )


def test_stage_change_requires_explicit_human_evidence_confirmation() -> None:
    with pytest.raises(ValueError, match="human ownership"):
        validate_transition(
            ApplicationStatus.under_review,
            ApplicationStatus.interview,
            human_confirmed=False,
            evidence_reviewed=True,
        )
