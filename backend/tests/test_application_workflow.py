import pytest

from app.models.entities import ApplicationStatus
from app.services.application_workflow import validate_transition


def test_allowed_application_transition() -> None:
    validate_transition(ApplicationStatus.applied, ApplicationStatus.under_review)


def test_skipping_required_stage_is_blocked() -> None:
    with pytest.raises(ValueError, match="not allowed"):
        validate_transition(ApplicationStatus.applied, ApplicationStatus.hired)
