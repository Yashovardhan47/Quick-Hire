# QuickHire EvidenceGraph

QuickHire EvidenceGraph is the AI-first evolution of Quick-Hire. It connects job requirements to verifiable candidate evidence from profiles, projects, assessments and structured interviews. AI produces transparent recommendations with confidence and missing-evidence explanations; a human recruiter remains responsible for employment decisions.

## Document and hybrid-ranking release · 0.3

- FastAPI API with role-based users, jobs, applications and candidate evidence
- PostgreSQL schema prepared for `pgvector`
- Explainable, uncertainty-aware EvidenceGraph matching engine
- Resume intelligence that extracts job-related claims while excluding sensitive fields
- PDF, DOCX and TXT ingestion with signature, archive, size and active-content checks
- English, Hindi and Telugu skill aliases with Indian-script language detection
- Job-description intelligence that creates weighted competencies and flags exclusionary wording
- Hybrid recommendations combining structured evidence, vector similarity and reranking
- Evidence citations, uncertainty intervals, confidence states and low-evidence abstention
- Optional external multilingual embedding and cross-encoder adapters, disabled by default
- Adaptive objective assessments selected from missing job evidence
- Structured typed mock interviews scored only against a disclosed content rubric
- Candidate, recruiter and platform-admin dashboards connected to the API
- Blind-first recruiter pipeline with valid stage transitions and mandatory human reasons
- Authenticated WebSocket events for application, assessment and interview updates
- Live governance metrics, audit events and versioned model outputs
- Offline NDCG, MRR, Brier, calibration-error and recommendation-coverage evaluation
- Docker Compose development environment

## Run locally

1. Copy `.env.example` to `.env` and replace every development secret.
2. Run `docker compose up --build`.
3. Open `http://localhost:5173`; API documentation is at `http://localhost:8000/docs`.

Candidates and recruiters can register in the interface. To create the first platform administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
docker compose exec backend python -m app.cli.create_admin
```

For an existing database, apply `database/migrations/0002_ai_workflows.sql` and then `database/migrations/0003_document_intelligence.sql`. New development databases are created from the current SQLAlchemy models.

By default, hybrid retrieval runs locally and candidate text is not sent to an external model. External embedding and reranking require `EXTERNAL_MODEL_DATA_PROCESSING_ENABLED=true`, explicit provider URLs and an API key. Enable that only after candidate notice, consent and vendor data-processing review.

## Validate

```bash
cd backend && PYTHONPATH=. pytest -q
cd frontend && npm run build
```

Evaluate a labeled JSONL ranking dataset with:

```bash
cd backend
python -m app.cli.evaluate_ranker evaluation.jsonl --k 10
```

## Decision boundary

QuickHire may retrieve, structure and summarize job-related evidence. It does not autonomously reject, shortlist or hire. Interview feedback is limited to typed answer content and never evaluates appearance, voice, accent, emotion, personality, disability, honesty or other protected and sensitive traits.

The previous PHP prototype remains in the branch history for reference. Do not reuse credentials that were ever committed to the public repository.

See [docs/AI_PLATFORM_BLUEPRINT.md](docs/AI_PLATFORM_BLUEPRINT.md) and [docs/MODEL_CARD.md](docs/MODEL_CARD.md) for the research architecture, intended use and limitations.
