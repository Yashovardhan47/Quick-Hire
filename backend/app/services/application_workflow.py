from app.models.entities import ApplicationStatus


ALLOWED_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.applied: {ApplicationStatus.under_review, ApplicationStatus.rejected},
    ApplicationStatus.under_review: {
        ApplicationStatus.assessment,
        ApplicationStatus.interview,
        ApplicationStatus.rejected,
    },
    ApplicationStatus.assessment: {
        ApplicationStatus.under_review,
        ApplicationStatus.interview,
        ApplicationStatus.rejected,
    },
    ApplicationStatus.interview: {
        ApplicationStatus.under_review,
        ApplicationStatus.offer,
        ApplicationStatus.rejected,
    },
    ApplicationStatus.offer: {ApplicationStatus.hired, ApplicationStatus.rejected},
    ApplicationStatus.hired: set(),
    ApplicationStatus.rejected: {ApplicationStatus.under_review},
    ApplicationStatus.withdrawn: set(),
}


def validate_transition(
    current: ApplicationStatus,
    target: ApplicationStatus,
    *,
    human_confirmed: bool = False,
    evidence_reviewed: bool = False,
) -> None:
    if not human_confirmed or not evidence_reviewed:
        raise ValueError("A recruiter must confirm both human ownership and job-related evidence review")
    if target == current:
        raise ValueError("Application is already in that stage")
    if target not in ALLOWED_TRANSITIONS[current]:
        raise ValueError(f"Transition from {current.value} to {target.value} is not allowed")
