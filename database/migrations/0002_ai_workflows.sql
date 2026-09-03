-- Upgrade an existing foundation database to the 0.2 AI workflow schema.
-- New development databases receive the same structure from SQLAlchemy.

CREATE TABLE IF NOT EXISTS application_stage_history (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    actor_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_application_stage_history_application_id ON application_stage_history(application_id);
CREATE INDEX IF NOT EXISTS ix_application_stage_history_to_status ON application_stage_history(to_status);
CREATE INDEX IF NOT EXISTS ix_application_stage_history_actor_id ON application_stage_history(actor_id);

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'in_progress';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS questions JSON NOT NULL DEFAULT '[]';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS answers JSON NOT NULL DEFAULT '{}';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS feedback JSON NOT NULL DEFAULT '[]';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS model_version VARCHAR(80) NOT NULL DEFAULT 'adaptive-assessment-0.2.0';
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS ix_assessment_attempts_status ON assessment_attempts(status);

ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'in_progress';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS questions JSON NOT NULL DEFAULT '[]';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS answers JSON NOT NULL DEFAULT '{}';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS content_feedback JSON NOT NULL DEFAULT '[]';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS model_version VARCHAR(80) NOT NULL DEFAULT 'structured-interview-0.2.0';
CREATE INDEX IF NOT EXISTS ix_interview_sessions_status ON interview_sessions(status);
