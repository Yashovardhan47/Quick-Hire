CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation_application UNIQUE (application_id)
);
CREATE INDEX IF NOT EXISTS ix_conversations_application_id ON conversations(application_id);
CREATE INDEX IF NOT EXISTS ix_conversations_updated_at ON conversations(updated_at);

INSERT INTO conversations (id, application_id)
SELECT md5(random()::text || clock_timestamp()::text), applications.id
FROM applications
ON CONFLICT (application_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS interview_schedules (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    organizer_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    meeting_url VARCHAR(500),
    status VARCHAR(40) NOT NULL DEFAULT 'proposed',
    candidate_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_interview_schedules_application_id ON interview_schedules(application_id);
CREATE INDEX IF NOT EXISTS ix_interview_schedules_organizer_id ON interview_schedules(organizer_id);
CREATE INDEX IF NOT EXISTS ix_interview_schedules_starts_at ON interview_schedules(starts_at);
CREATE INDEX IF NOT EXISTS ix_interview_schedules_status ON interview_schedules(status);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    browser_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_transactional_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(120) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSON NOT NULL DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_event_type ON notifications(event_type);
CREATE INDEX IF NOT EXISTS ix_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id VARCHAR(36) PRIMARY KEY,
    notification_id VARCHAR(36) NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(40) NOT NULL DEFAULT 'email',
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_delivery_channel UNIQUE (notification_id, channel)
);
CREATE INDEX IF NOT EXISTS ix_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS ix_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS ix_notification_deliveries_next_attempt_at ON notification_deliveries(next_attempt_at);

CREATE TABLE IF NOT EXISTS model_evaluation_runs (
    id VARCHAR(36) PRIMARY KEY,
    model_version VARCHAR(120) NOT NULL,
    dataset_version VARCHAR(120) NOT NULL,
    metrics JSON NOT NULL DEFAULT '{}',
    status VARCHAR(40) NOT NULL DEFAULT 'evaluated',
    approved_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_model_evaluation_runs_model_version ON model_evaluation_runs(model_version);
CREATE INDEX IF NOT EXISTS ix_model_evaluation_runs_status ON model_evaluation_runs(status);

CREATE TABLE IF NOT EXISTS candidate_requests (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(60) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'submitted',
    resolution TEXT NOT NULL DEFAULT '',
    resolved_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_candidate_requests_candidate_id ON candidate_requests(candidate_id);
CREATE INDEX IF NOT EXISTS ix_candidate_requests_request_type ON candidate_requests(request_type);
CREATE INDEX IF NOT EXISTS ix_candidate_requests_status ON candidate_requests(status);

CREATE TABLE IF NOT EXISTS auth_action_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(40) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_user_id ON auth_action_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_purpose ON auth_action_tokens(purpose);
CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_token_hash ON auth_action_tokens(token_hash);
CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_expires_at ON auth_action_tokens(expires_at);

CREATE TABLE IF NOT EXISTS candidate_consents (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(80) NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT FALSE,
    policy_version VARCHAR(120) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_consent_purpose UNIQUE (candidate_id, purpose)
);
CREATE INDEX IF NOT EXISTS ix_candidate_consents_candidate_id ON candidate_consents(candidate_id);
CREATE INDEX IF NOT EXISTS ix_candidate_consents_purpose ON candidate_consents(purpose);
