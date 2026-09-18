"""Fail-fast validation for QuickHire's account-owned production inputs.

Usage: python infrastructure/preflight.py .env.production
The script reports variable names only; it never prints secret values.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


REQUIRED = {
    "SECRET_KEY",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "REDIS_PASSWORD",
    "REDIS_URL",
    "APP_DOMAIN",
    "API_DOMAIN",
    "FRONTEND_ORIGINS",
    "ALLOWED_HOSTS",
    "PUBLIC_FRONTEND_URL",
    "GOOGLE_CLIENT_ID",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
}
PLACEHOLDERS = ("replace-with", "your-google", "example.com", "example.invalid", "generate-a-random")


def parse(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ".env.production")
    if not path.is_file():
        print(f"ERROR: {path} does not exist")
        return 1
    values = parse(path)
    errors: list[str] = []
    for key in sorted(REQUIRED):
        value = values.get(key, "")
        if not value:
            errors.append(f"{key} is missing")
        elif any(marker in value.lower() for marker in PLACEHOLDERS):
            errors.append(f"{key} still contains a placeholder")
    if len(values.get("SECRET_KEY", "")) < 32:
        errors.append("SECRET_KEY must contain at least 32 characters")
    if len(values.get("POSTGRES_PASSWORD", "")) < 20:
        errors.append("POSTGRES_PASSWORD must contain at least 20 characters")
    if len(values.get("REDIS_PASSWORD", "")) < 20:
        errors.append("REDIS_PASSWORD must contain at least 20 characters")
    if len(values.get("ADMIN_PASSWORD", "")) < 16:
        errors.append("ADMIN_PASSWORD must contain at least 16 characters")
    if values.get("APP_DOMAIN") == values.get("API_DOMAIN"):
        errors.append("APP_DOMAIN and API_DOMAIN must be different hostnames")
    if values.get("FRONTEND_ORIGINS") != f"https://{values.get('APP_DOMAIN', '')}":
        errors.append("FRONTEND_ORIGINS must exactly match https://APP_DOMAIN")
    if values.get("ALLOWED_HOSTS") != values.get("API_DOMAIN"):
        errors.append("ALLOWED_HOSTS must exactly match API_DOMAIN")
    if values.get("PUBLIC_FRONTEND_URL") != f"https://{values.get('APP_DOMAIN', '')}":
        errors.append("PUBLIC_FRONTEND_URL must exactly match https://APP_DOMAIN")
    expected_flags = {
        "APP_ENV": "production",
        "REFRESH_COOKIE_SECURE": "true",
        "AUTO_CREATE_TABLES": "false",
        "REQUIRE_GOOGLE_AUTH": "true",
        "REQUIRE_EMAIL_VERIFICATION": "true",
        "EMAIL_DELIVERY_ENABLED": "true",
        "MALWARE_SCAN_ENABLED": "true",
        "MALWARE_SCAN_REQUIRED": "true",
        "REJECT_SCANNED_PDF_WITHOUT_TEXT": "true",
    }
    for key, expected in expected_flags.items():
        if values.get(key, "").lower() != expected:
            errors.append(f"{key} must be {expected} for this production topology")
    if not values.get("DATABASE_URL", "").startswith("postgresql+asyncpg://"):
        errors.append("DATABASE_URL must use postgresql+asyncpg")
    if not values.get("REDIS_URL", "").startswith("redis://:"):
        errors.append("REDIS_URL must use authenticated Redis syntax")
    if values.get("EMAIL_PROVIDER") != "resend":
        errors.append("EMAIL_PROVIDER must be resend when production email is enabled")
    client_id = values.get("GOOGLE_CLIENT_ID", "")
    if client_id and not client_id.endswith(".apps.googleusercontent.com"):
        errors.append("GOOGLE_CLIENT_ID is not a Google web client ID")
    if values.get("EMAIL_DELIVERY_ENABLED", "false").lower() == "true":
        for key in ("EMAIL_FROM", "RESEND_API_KEY"):
            if not values.get(key) or any(marker in values[key].lower() for marker in PLACEHOLDERS):
                errors.append(f"{key} is required when email delivery is enabled")
    if values.get("REQUIRE_EMAIL_VERIFICATION", "false").lower() == "true" and values.get("EMAIL_DELIVERY_ENABLED", "false").lower() != "true":
        errors.append("EMAIL_DELIVERY_ENABLED must be true when verified email is required")
    if values.get("REQUIRE_CALIBRATED_MODEL", "false").lower() == "true" and not values.get("CALIBRATION_MODEL_PATH"):
        errors.append("CALIBRATION_MODEL_PATH is required when calibrated confidence is enforced")
    if values.get("VOICE_TRANSCRIPTION_ENABLED", "false").lower() == "true":
        if values.get("EXTERNAL_MODEL_DATA_PROCESSING_ENABLED", "false").lower() != "true":
            errors.append("EXTERNAL_MODEL_DATA_PROCESSING_ENABLED must be true when voice transcription is enabled")
        for key in ("AI_API_KEY", "TRANSCRIPTION_API_URL", "TRANSCRIPTION_MODEL"):
            if not values.get(key):
                errors.append(f"{key} is required when voice transcription is enabled")
    if values.get("LLM_API_URL") and not values.get("AI_API_KEY"):
        errors.append("AI_API_KEY is required when LLM_API_URL is configured")
    if values.get("MALWARE_SCAN_REQUIRED", "false").lower() == "true":
        if values.get("MALWARE_SCAN_ENABLED", "false").lower() != "true":
            errors.append("MALWARE_SCAN_ENABLED must be true when malware scanning is required")
        if not values.get("CLAMAV_HOST"):
            errors.append("CLAMAV_HOST is required when malware scanning is required")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", values.get("ADMIN_EMAIL", "")):
        errors.append("ADMIN_EMAIL must be a valid email address")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("Production preflight passed: required domains, identities, delivery settings, and secrets are configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
