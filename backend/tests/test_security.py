from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token, generate_refresh_token, hash_refresh_token


def test_access_token_has_explicit_type_audience_issuer_and_session() -> None:
    token = create_access_token("candidate-1", "candidate", "session-1")
    payload = decode_access_token(token)

    assert payload["sub"] == "candidate-1"
    assert payload["role"] == "candidate"
    assert payload["token_type"] == "access"
    assert payload["sid"] == "session-1"
    assert payload["jti"]


def test_non_access_jwt_cannot_be_used_as_an_access_token() -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "candidate-1",
            "role": "candidate",
            "token_type": "refresh",
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.secret_key,
        algorithm="HS256",
    )

    with pytest.raises(HTTPException, match="Invalid or expired"):
        decode_access_token(token)


def test_refresh_tokens_are_high_entropy_unique_and_only_compared_by_hash() -> None:
    first = generate_refresh_token()
    second = generate_refresh_token()

    assert first != second
    assert len(first) >= 80
    assert hash_refresh_token(first) != first
    assert len(hash_refresh_token(first)) == 64
    assert hash_refresh_token(first) != hash_refresh_token(second)
