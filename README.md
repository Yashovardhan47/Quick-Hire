# QuickHire EvidenceGraph

QuickHire EvidenceGraph is the AI-first evolution of Quick-Hire. It connects job requirements to verifiable candidate evidence from profiles, projects, assessments and structured interviews. AI produces transparent recommendations with confidence and missing-evidence explanations; a human recruiter remains responsible for employment decisions.

## AI workflow release · 0.2

- FastAPI API with role-based users, jobs, applications and candidate evidence
- PostgreSQL schema prepared for `pgvector`
- Explainable, uncertainty-aware EvidenceGraph matching engine
- Resume intelligence that extracts job-related claims while excluding sensitive fields
- Job-description intelligence that creates weighted competencies and flags exclusionary wording
- Evidence-ranked job recommendations with confidence intervals and counterfactual next steps
- Adaptive objective assessments selected from missing job evidence
- Structured typed mock interviews scored only against a disclosed content rubric
- Candidate, recruiter and platform-admin dashboards connected to the API
- Blind-first recruiter pipeline with valid stage transitions and mandatory human reasons
- Authenticated WebSocket events for application, assessment and interview updates
- Live governance metrics, audit events and versioned model outputs
- Docker Compose development environment

## Run locally

1. Copy `.env.example` to `.env` and replace every development secret.
2. Run `docker compose up --build`.
3. Open `http://localhost:5173`; API documentation is at `http://localhost:8000/docs`.

Candidates and recruiters can register in the interface. To create the first platform administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
docker compose exec backend python -m app.cli.create_admin
```

For an existing 0.1 database, apply `database/migrations/0002_ai_workflows.sql` before starting 0.2. New development databases are created from the current SQLAlchemy models.

## Validate

```bash
cd backend && PYTHONPATH=. pytest -q
cd frontend && npm run build
```

## Decision boundary

QuickHire may retrieve, structure and summarize job-related evidence. It does not autonomously reject, shortlist or hire. Interview feedback is limited to typed answer content and never evaluates appearance, voice, accent, emotion, personality, disability, honesty or other protected and sensitive traits.

The previous PHP prototype remains in the branch history for reference. Do not reuse credentials that were ever committed to the public repository.

See [docs/AI_PLATFORM_BLUEPRINT.md](docs/AI_PLATFORM_BLUEPRINT.md) for the planned research and product architecture.
