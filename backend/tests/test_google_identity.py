import pytest

from app.services.google_identity import GoogleIdentityError, validate_google_claims


def google_claims(**overrides) -> dict:
    claims = {
        "aud": "client.apps.googleusercontent.com",
        "iss": "https://accounts.google.com",
        "sub": "google-stable-subject-123",
        "email": "Candidate@Example.com",
        "email_verified": True,
        "name": "Candidate One",
    }
    claims.update(overrides)
    return claims


def test_google_identity_uses_verified_subject_and_normalized_email() -> None:
    identity = validate_google_claims(google_claims(), "client.apps.googleusercontent.com")

    assert identity.subject == "google-stable-subject-123"
    assert identity.email == "candidate@example.com"
    assert identity.full_name == "Candidate One"


@pytest.mark.parametrize(
    ("claim", "value", "message"),
    [
        ("aud", "other-client", "audience"),
        ("iss", "https://malicious.example", "issuer"),
        ("email_verified", False, "not verified"),
        ("sub", "", "identifier"),
    ],
)
def test_google_identity_rejects_untrusted_claims(claim: str, value, message: str) -> None:
    with pytest.raises(GoogleIdentityError, match=message):
        validate_google_claims(google_claims(**{claim: value}), "client.apps.googleusercontent.com")
