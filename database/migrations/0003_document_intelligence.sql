-- Upgrade an existing 0.2 database with privacy-preserving document metadata.
-- Raw resume files and full extracted text are intentionally not stored here.

CREATE TABLE IF NOT EXISTS candidate_documents (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(120) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    size_bytes INTEGER NOT NULL,
    text_length INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    language_codes JSON NOT NULL DEFAULT '[]',
    security_flags JSON NOT NULL DEFAULT '[]',
    analysis JSON NOT NULL DEFAULT '{}',
    extraction_status VARCHAR(40) NOT NULL DEFAULT 'completed',
    model_version VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_document_sha UNIQUE (candidate_id, sha256)
);

CREATE INDEX IF NOT EXISTS ix_candidate_documents_candidate_id ON candidate_documents(candidate_id);
CREATE INDEX IF NOT EXISTS ix_candidate_documents_sha256 ON candidate_documents(sha256);
CREATE INDEX IF NOT EXISTS ix_candidate_documents_extraction_status ON candidate_documents(extraction_status);
