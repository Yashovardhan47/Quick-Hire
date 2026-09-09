-- Upgrade an existing 0.3 database with Google identity, rotating refresh
-- sessions and explicit human-decision evidence.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_linked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_subject ON users(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    replaced_by_session_id VARCHAR(36) REFERENCES refresh_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_expires_at ON refresh_sessions(expires_at);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_revoked_at ON refresh_sessions(revoked_at);

ALTER TABLE application_stage_history ADD COLUMN IF NOT EXISTS human_confirmed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE application_stage_history ADD COLUMN IF NOT EXISTS decision_source VARCHAR(40) NOT NULL DEFAULT 'human_actor';
