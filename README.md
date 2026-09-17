# QuickHire EvidenceGraph

QuickHire EvidenceGraph is the AI-first evolution of Quick-Hire. It connects job requirements to verifiable candidate evidence from profiles, projects, assessments and structured interviews. AI produces transparent recommendations with confidence and missing-evidence explanations; a human recruiter remains responsible for employment decisions.

## Production-workflow release · 0.5

- Short-lived, issuer/audience/type-bound access JWTs
- Rotating opaque refresh sessions in strict, HTTP-only cookies
- Refresh-token hashes only in the database, with account-wide replay revocation
- Password registration and sign-in for candidates, recruiters and controlled admins
- Single-use email verification and password recovery with session revocation
- Backend-verified Google Identity Services sign-in for candidates and recruiters
- Google identities bound to the stable `sub` claim; no silent email-based account linking
- Authenticated in-account Google linking requiring an exact email match
- Server-side prohibited-signal blocking at jobs, ranking profiles and evidence entry
- Defense-in-depth removal of sensitive legacy signals before local or external ranking
- Revocable, versioned candidate consent required before any external embedding or reranking
- Explicit human evidence review, confirmation and reasoning for every recruiter stage change
- Admin-visible, versioned employment-AI policy
- Public animated product interface with the narrated 24-second overview
- Live published-job marketplace (no hard-coded production jobs)
- Animated candidate, recruiter and admin analytics derived only from current database records
- Persistent candidate/recruiter messages with authorization boundaries
- Human-confirmed interview scheduling and secure meeting links
- Durable in-app notifications, Redis WebSocket fan-out and a retrying email outbox worker
- Candidate application tracker and candidate-controlled withdrawal
- Advisory-only recruiter assistant for queue, evidence and interview preparation
- Candidate correction, appeal, accommodation, export and deletion request workflow
- Checksummed foundation migrations for an empty production PostgreSQL database
- Production containers, automatic TLS proxy, health/readiness probes and structured request logs
- Representative-data calibration tooling with explicit uncalibrated behavior by default

The EvidenceGraph 0.3 model capabilities remain available:

- FastAPI API with role-based users, jobs, applications and candidate evidence
- PostgreSQL schema prepared for `pgvector`
- Explainable, uncertainty-aware EvidenceGraph matching engine
- Resume intelligence that extracts job-related claims while excluding sensitive fields
- PDF, DOCX and TXT ingestion with signature, archive, size and active-content checks
- Fail-closed ClamAV screening and accessible-text enforcement in production
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

### Enable Google sign-in

1. Create a Google OAuth **Web application** client and add the exact frontend origins, such as `http://localhost:5173` for local development.
2. Put the same client ID in `GOOGLE_CLIENT_ID` in the root `.env` file.
3. If running the frontend directly instead of Compose, copy `frontend/.env.example` to `frontend/.env` and set `VITE_GOOGLE_CLIENT_ID` there.

The browser credential is always sent to the backend for signature, audience, issuer and verified-email checks. Google sign-in can never create or link a platform-admin account.

Candidates and recruiters can register in the interface. To create the first platform administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run:

```bash
docker compose exec backend python -m app.cli.create_admin
```

Production databases are created and upgraded by `python -m app.cli.migrate`; do not edit an applied migration. Development can still create the current SQLAlchemy schema automatically.

By default, hybrid retrieval runs locally and candidate text is not sent to an external model. External embedding and reranking require `EXTERNAL_MODEL_DATA_PROCESSING_ENABLED=true`, explicit provider URLs, an API key, and a current opt-in from the individual candidate. Enable the provider only after vendor data-processing review; the server enforces consent and returns to local matching when it is revoked.

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

Fit a versioned confidence artifact only from representative, human-reviewed labels:

```bash
cd backend
python -m app.cli.fit_calibrator labels.jsonl confidence-calibration.json --dataset-version reviewed-v1
```

## Deploy

The production Compose stack includes PostgreSQL, authenticated Redis, a checksummed migration job, two API workers, the notification-delivery worker, the React frontend and automatic HTTPS through Caddy. Follow [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md); production intentionally fails fast when required Google, domain, email or secret settings are missing.

## Decision boundary

QuickHire may retrieve, structure and summarize job-related evidence. It does not autonomously reject, shortlist or hire. Interview feedback is limited to typed answer content and never evaluates appearance, voice, accent, emotion, personality, disability, honesty or other protected and sensitive traits. These rules are enforced in API validation, ranking-input sanitation, assessment/interview generation, recruiter confirmations, tests and the admin policy endpoint.

The previous PHP prototype remains in the branch history for reference. Do not reuse credentials that were ever committed to the public repository.

See [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md), [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md), [docs/AI_GOVERNANCE_POLICY.md](docs/AI_GOVERNANCE_POLICY.md), [docs/AI_PLATFORM_BLUEPRINT.md](docs/AI_PLATFORM_BLUEPRINT.md) and [docs/MODEL_CARD.md](docs/MODEL_CARD.md) for deployment, security, governance and research boundaries.
