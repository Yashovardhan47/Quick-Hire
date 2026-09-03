# QuickHire EvidenceGraph

QuickHire EvidenceGraph is the AI-first evolution of Quick-Hire. It connects job requirements to verifiable candidate evidence from profiles, projects, assessments and structured interviews. AI produces transparent recommendations with confidence and missing-evidence explanations; a human recruiter remains responsible for employment decisions.

## First foundation release

- FastAPI API with role-based users, jobs, applications and candidate evidence
- PostgreSQL schema prepared for `pgvector`
- Explainable, uncertainty-aware EvidenceGraph matching engine
- Candidate, recruiter and platform-admin dashboard foundations
- WebSocket event channel for live application and interview updates
- Audit-ready model version and explanation fields
- Docker Compose development environment

## Run locally

1. Copy `.env.example` to `.env` and replace every development secret.
2. Run `docker compose up --build`.
3. Open `http://localhost:5173`; API documentation is at `http://localhost:8000/docs`.

The previous PHP prototype remains in the branch history for reference. Do not reuse credentials that were ever committed to the public repository.

See [docs/AI_PLATFORM_BLUEPRINT.md](docs/AI_PLATFORM_BLUEPRINT.md) for the planned research and product architecture.

