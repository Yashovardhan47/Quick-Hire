from dataclasses import dataclass
from functools import partial

from anyio import to_thread
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests
from google.oauth2 import id_token


ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleIdentityError(ValueError):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    full_name: str
    picture_url: str | None = None


def validate_google_claims(claims: dict, client_id: str) -> GoogleIdentity:
    audience = claims.get("aud")
    audience_matches = client_id in audience if isinstance(audience, list) else audience == client_id
    if not audience_matches:
        raise GoogleIdentityError("Google token audience does not match this QuickHire deployment")
    if claims.get("iss") not in ALLOWED_ISSUERS:
        raise GoogleIdentityError("Google token issuer is invalid")
    subject = str(claims.get("sub", "")).strip()
    email = str(claims.get("email", "")).strip().lower()
    if not subject or len(subject) > 255:
        raise GoogleIdentityError("Google account identifier is missing or invalid")
    if not email or "@" not in email or len(email) > 320:
        raise GoogleIdentityError("Google account email is missing or invalid")
    if claims.get("email_verified") is not True:
        raise GoogleIdentityError("Google account email is not verified")
    full_name = str(claims.get("name", "")).strip()[:160] or email.split("@", 1)[0]
    picture = str(claims.get("picture", "")).strip() or None
    return GoogleIdentity(subject=subject, email=email, full_name=full_name, picture_url=picture)


def _verify_credential(credential: str, client_id: str) -> dict:
    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)


async def verify_google_credential(credential: str, client_id: str) -> GoogleIdentity:
    try:
        claims = await to_thread.run_sync(partial(_verify_credential, credential, client_id))
    except (GoogleAuthError, ValueError) as exc:
        raise GoogleIdentityError("Google credential is invalid or expired") from exc
    return validate_google_claims(claims, client_id)
