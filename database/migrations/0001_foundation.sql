CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
    CREATE TYPE userrole AS ENUM ('candidate', 'recruiter', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE applicationstatus AS ENUM ('applied', 'under_review', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role userrole NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

CREATE TABLE IF NOT EXISTS candidate_profiles (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline VARCHAR(200) NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    location VARCHAR(160) NOT NULL DEFAULT '',
    experience_years DOUBLE PRECISION NOT NULL DEFAULT 0,
    skills JSON NOT NULL DEFAULT '[]',
    preferences JSON NOT NULL DEFAULT '{}',
    resume_object_key VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_evidence (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(160) NOT NULL,
    source_type VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    strength DOUBLE PRECISION NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    source_uri VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_candidate_evidence_candidate_id ON candidate_evidence(candidate_id);
CREATE INDEX IF NOT EXISTS ix_candidate_evidence_skill ON candidate_evidence(skill);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    recruiter_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(160) NOT NULL DEFAULT '',
    employment_type VARCHAR(60) NOT NULL DEFAULT 'full-time',
    requirements JSON NOT NULL DEFAULT '[]',
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_jobs_recruiter_id ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS ix_jobs_title ON jobs(title);
CREATE INDEX IF NOT EXISTS ix_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status applicationstatus NOT NULL DEFAULT 'applied',
    fit_score DOUBLE PRECISION,
    fit_confidence DOUBLE PRECISION,
    explanation JSON NOT NULL DEFAULT '{}',
    human_decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_job_candidate UNIQUE (job_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS ix_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS ix_applications_candidate_id ON applications(candidate_id);

CREATE TABLE IF NOT EXISTS assessment_attempts (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    competency_scores JSON NOT NULL DEFAULT '{}',
    score DOUBLE PRECISION,
    integrity_flags JSON NOT NULL DEFAULT '[]',
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_assessment_attempts_candidate_id ON assessment_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS ix_assessment_attempts_job_id ON assessment_attempts(job_id);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ,
    transcript_object_key VARCHAR(500),
    rubric_scores JSON NOT NULL DEFAULT '{}',
    human_reviewed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_candidate_id ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_job_id ON interview_sessions(job_id);

CREATE TABLE IF NOT EXISTS recommendations (
    id VARCHAR(36) PRIMARY KEY,
    subject_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR(36) REFERENCES jobs(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(80) NOT NULL,
    payload JSON NOT NULL,
    model_version VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_recommendations_subject_user_id ON recommendations(subject_user_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(80),
    details JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_events_action ON audit_events(action);
