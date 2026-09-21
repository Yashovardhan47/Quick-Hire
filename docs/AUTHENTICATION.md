# QuickHire authentication 0.5

## Session model

QuickHire issues a short-lived access JWT after password or Google authentication. The token contains a subject, role, session ID, unique token ID, explicit `access` type, issuer, audience, issued-at time and expiry. API role checks use this token.

## Role perspectives

- A job seeker registration creates an immutable `candidate` identity and exposes only candidate routes, navigation and APIs.
- A recruiter registration creates an immutable `recruiter` identity and exposes only recruiter routes, navigation and APIs.
- An administrator registration requires a single-use token bound to the invited email and issued by an existing verified administrator.
- On every application load, `/auth/me` replaces cached browser identity data with the server-authoritative role.
- Entering another role's URL redirects to the signed-in user's own workspace; calling another role's API returns `403`.

The first administrator is bootstrapped with `python -m app.cli.create_admin`. Further administrators are invited from the Admin dashboard. Creating a new invite revokes any older unused invite for the same email; only the token digest is stored, and successful registration consumes it.

The longer-lived refresh credential is an opaque random value in a strict, HTTP-only cookie scoped to `/api/v1/auth`. Only its SHA-256 digest is stored. Refreshing locks the current session row, revokes it, creates a replacement and rotates the cookie. Reusing a rotated credential revokes every still-active refresh session for that user and writes an audit event.

Access tokens remain valid only for their short lifetime after logout. The frontend keeps the access token in session storage, automatically refreshes once after an unauthorized API response, deduplicates simultaneous refresh requests and never reads the refresh cookie.

## Google sign-in

The frontend uses Google Identity Services to receive an ID-token credential. The backend then verifies it with Google's maintained authentication library and checks the configured audience, accepted Google issuer, stable subject, email and `email_verified` claim.

- A new Google account requires an explicit candidate or recruiter role.
- Google cannot create, sign into or link a platform administrator; invited admins use password authentication.
- Existing accounts are never linked merely because the email matches.
- An existing password user must sign in first and use Account & safety to link Google.
- Linking requires the Google email to exactly match the signed-in QuickHire email.
- The Google `sub` claim, not email, is the durable provider identity.

## Production requirements

- Generate a unique `SECRET_KEY` with at least 32 random characters.
- Set `REFRESH_COOKIE_SECURE=true` and serve the application over HTTPS.
- Use the exact same Google Web client ID in backend and frontend configuration.
- Register every exact frontend origin in the Google Cloud client.
- Keep frontend and API on the same site or review the cookie and CSRF design before cross-site deployment.
- Apply the checksummed migration chain through `0005_production_workflows.sql`.
- Keep Redis-backed authentication rate limiting fail-closed in production.
- Configure the email worker so one-time verification and password-reset links can be delivered.
- Verification/reset credentials are stored as hashes, expire, are single-use, and supersede older unused credentials of the same purpose.
- Password reset revokes all active refresh sessions for the account.
- Consequential candidate/recruiter workflows require verified email when `REQUIRE_EMAIL_VERIFICATION=true`.
- Follow the secret rotation and incident procedures in the production runbook.
