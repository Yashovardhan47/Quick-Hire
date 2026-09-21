-- Role-specific onboarding: single-use, email-bound administrator invitations.
CREATE TABLE IF NOT EXISTS admin_invites (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_admin_invites_email ON admin_invites(email);
CREATE INDEX IF NOT EXISTS ix_admin_invites_token_hash ON admin_invites(token_hash);
CREATE INDEX IF NOT EXISTS ix_admin_invites_created_by ON admin_invites(created_by);
CREATE INDEX IF NOT EXISTS ix_admin_invites_expires_at ON admin_invites(expires_at);
CREATE INDEX IF NOT EXISTS ix_admin_invites_used_at ON admin_invites(used_at);
CREATE INDEX IF NOT EXISTS ix_admin_invites_revoked_at ON admin_invites(revoked_at);
