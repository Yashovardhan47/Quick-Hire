-- Evidence-grounded RAG, vector retrieval, auditable agents and answer-text provenance.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS candidate_knowledge_chunks (
    id VARCHAR(36) PRIMARY KEY,
    candidate_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id VARCHAR(36) NOT NULL REFERENCES candidate_documents(id) ON DELETE CASCADE,
    locator VARCHAR(160) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    embedding VECTOR(384) NOT NULL,
    model_version VARCHAR(80) NOT NULL DEFAULT 'local-feature-hash-384-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_chunk_source UNIQUE (document_id, locator, content_hash)
);
CREATE INDEX IF NOT EXISTS ix_candidate_knowledge_chunks_candidate_id ON candidate_knowledge_chunks(candidate_id);
CREATE INDEX IF NOT EXISTS ix_candidate_knowledge_chunks_document_id ON candidate_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS ix_candidate_knowledge_chunks_content_hash ON candidate_knowledge_chunks(content_hash);
CREATE INDEX IF NOT EXISTS ix_candidate_knowledge_chunks_embedding_hnsw
    ON candidate_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS job_knowledge_chunks (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    locator VARCHAR(160) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    embedding VECTOR(384) NOT NULL,
    model_version VARCHAR(80) NOT NULL DEFAULT 'local-feature-hash-384-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_job_chunk_source UNIQUE (job_id, locator, content_hash)
);
CREATE INDEX IF NOT EXISTS ix_job_knowledge_chunks_job_id ON job_knowledge_chunks(job_id);
CREATE INDEX IF NOT EXISTS ix_job_knowledge_chunks_content_hash ON job_knowledge_chunks(content_hash);
CREATE INDEX IF NOT EXISTS ix_job_knowledge_chunks_embedding_hnsw
    ON job_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS agent_runs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    workflow VARCHAR(100) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(80),
    status VARCHAR(40) NOT NULL DEFAULT 'completed',
    trace JSON NOT NULL DEFAULT '[]',
    output JSON NOT NULL DEFAULT '{}',
    model_version VARCHAR(120) NOT NULL,
    advisory_only BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_agent_runs_actor_id ON agent_runs(actor_id);
CREATE INDEX IF NOT EXISTS ix_agent_runs_workflow ON agent_runs(workflow);
CREATE INDEX IF NOT EXISTS ix_agent_runs_status ON agent_runs(status);

ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS input_mode VARCHAR(40) NOT NULL DEFAULT 'answer_text_only';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS agent_trace JSON NOT NULL DEFAULT '[]';
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS evaluation_provenance JSON NOT NULL DEFAULT '{}';
