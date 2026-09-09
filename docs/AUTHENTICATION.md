# QuickHire authentication 0.4

## Session model

QuickHire issues a short-lived access JWT after password or Google authentication. The token contains a subject, role, session ID, unique token ID, explicit `access` type, issuer, audience, issued-at time and expiry. API role checks use this token.

The longer-lived refresh credential is an opaque random value in a strict, HTTP-only cookie scoped to `/api/v1/auth`. Only its SHA-256 digest is stored. Refreshing locks the current session row, revokes it, creates a replacement and rotates the cookie. Reusing a rotated credential revokes every still-active refresh session for that user and writes an audit event.

Access tokens remain valid only for their short lifetime after logout. The frontend keeps the access token in session storage, automatically refreshes once after an unauthorized API response, deduplicates simultaneous refresh requests and never reads the refresh cookie.

## Google sign-in

The frontend uses Google Identity Services to receive an ID-token credential. The backend then verifies it with Google's maintained authentication library and checks the configured audience, accepted Google issuer, stable subject, email and `email_verified` claim.

- A new Google account requires an explicit candidate or recruiter role.
- Google cannot create, sign into or link a platform administrator.
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
- Apply migration `0004_auth_governance.sql` to an existing 0.3 database.
- Add rate limiting, email verification/recovery and secret rotation procedures before public production use.
