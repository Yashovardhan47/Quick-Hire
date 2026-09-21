# QuickHire production deployment

This runbook deploys the real FastAPI, React, PostgreSQL, Redis, WebSocket, migration, and notification-worker stack. The public review Site remains a product demo until it is pointed at this deployed API.

## 1. Account-owned prerequisites

Provision these before launch:

- A Linux host with Docker Engine and Docker Compose v2
- Two DNS records: one for the web application and one for the API
- A Google OAuth 2.0 **Web application** client ID
- A verified email-sending domain and Resend API key if email delivery is enabled
- Encrypted persistent storage for PostgreSQL, Redis, and host backups
- Enough memory and disk for the pinned ClamAV daemon and regularly updated signature database
- A log/uptime destination that can alert the operating team

The Google client must authorize the exact production frontend origin. Add both the frontend and API domains to the provider configuration as appropriate; never use wildcard origins.

For optional neural retrieval or transcription, choose reviewed provider endpoints or a host with enough CPU/GPU, memory and model storage for the private `ai-worker` profile. Review model licenses and pin approved revisions before launch.

## 2. Configure secrets

```bash
cp .env.production.example .env.production
openssl rand -hex 48  # use for SECRET_KEY
openssl rand -base64 32  # generate separate PostgreSQL and Redis passwords
python infrastructure/preflight.py .env.production
```

Do not commit `.env.production`. Use a secrets manager or a root-readable host file. The preflight command reports variable names only and never prints secret values.

The credentials found in the old public PHP history must be revoked before launch. Removing them from a recent commit is not revocation.

## 3. DNS and TLS

Point `APP_DOMAIN` and `API_DOMAIN` at the server. Caddy obtains and renews TLS certificates automatically, so inbound TCP ports 80 and 443 must reach the host.

## 4. Deploy

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build --pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl --fail https://$API_DOMAIN/health/live
curl --fail https://$API_DOMAIN/health/ready
```

The one-shot `migrate` service applies checksummed SQL migrations under an advisory lock before the API and worker start. It is safe to run the same release more than once; changing an already-applied migration is rejected. Redis fans authenticated WebSocket events across all API workers, while PostgreSQL notifications remain the durable source when a browser is offline.

Create the first controlled platform administrator after the services are healthy:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec backend python -m app.cli.create_admin
docker compose --env-file .env.production -f docker-compose.production.yml exec backend python -m app.cli.reindex_knowledge
```

Candidates and recruiters may register with password or Google. Google can never create an administrator.

After the first controlled administrator signs in, use the Admin dashboard to issue subsequent administrator invitations. Each link is single-use, expires in at most seven days, is bound to one email address and stores only a token hash. Test that each account is redirected to—and can call APIs only for—its Job Seeker, Recruiter or Platform Admin perspective.

### Optional private neural worker

Set a long random `AI_API_KEY`, point the embedding, reranking and transcription URLs at `http://ai-worker:8100`, and start the private profile:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml --profile private-ai up -d --build
```

Set `EXTERNAL_MODEL_DATA_PROCESSING_ENABLED=true` only after consent, retention and model review. Set `VOICE_TRANSCRIPTION_ENABLED=true` only when the transcription endpoint is healthy. Audio is sent for transcription only after candidate consent and is not stored by QuickHire or the private worker.

## 5. Verify the full workflow

Use separate candidate and recruiter test accounts and verify:

1. The recruiter publishes a competency-based job.
2. The candidate uploads a document, receives evidence-linked recommendations, and applies.
3. The recruiter sees that real applicant in the selected job pipeline.
4. Both sides exchange a persisted message.
5. The recruiter proposes an interview; the candidate confirms it.
6. Browser and in-app notifications arrive; the email outbox changes from pending to sent.
7. A stage change fails without evidence review, human confirmation, and a reason.
8. A candidate request is visible only to that candidate and a platform administrator.
9. `/health/ready` reports the database and Redis as available.
10. A clean resume passes ClamAV, an EICAR test file is rejected, and a scan-only PDF fails closed with an accessible-file instruction.
11. External embedding/reranking remains unused for a candidate until that candidate explicitly opts in, and revocation returns active matches to local processing.
12. Interview questions show retrieved source locators and a deliberately injected document instruction cannot alter the system policy.
13. If voice transcription is enabled, the candidate can edit the transcript and the audit event confirms that audio was discarded and no audio feature reached evaluation.
14. Recruiter-copilot searches are confined to the selected recruiter-owned job and cannot change an application stage.

## 6. Backups and recovery

Create encrypted off-host PostgreSQL backups on a schedule appropriate to the recovery objective. A minimal logical backup is:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  pg_dump -U quickhire -d quickhire --format=custom > quickhire-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Treat backup files as sensitive candidate data. Encrypt, restrict access, define retention, and test restoration into a separate database at least quarterly. Redis contains ephemeral rate-limit and delivery coordination state; PostgreSQL is the canonical record.

Before every database release, capture a backup and verify that the current migration checksums are unchanged.

## 7. Monitoring and incident response

Alert on:

- `/health/ready` returning 503
- sustained API 5xx responses or authentication 429/503 spikes
- notification delivery failures or a growing pending outbox
- worker restarts
- PostgreSQL disk, connection, replication, and backup failures
- Redis memory or availability problems
- unusual login, refresh replay, or admin audit events

API logs are structured JSON and include an `X-Request-ID` without request bodies or secrets. Forward container logs to the chosen provider and define a retention period. The platform-admin dashboard shows live connections, message and interview counts, audit activity, and notification-delivery state.

If a secret is exposed, revoke it at its provider, rotate the production value, restart affected services, revoke active sessions when relevant, and record the incident. Merely editing Git history is insufficient.

## 8. Confidence calibration and model release

QuickHire labels confidence as **uncalibrated** until a representative outcome dataset is supplied. Do not invent an artifact.

The JSONL calibration dataset must contain job-grouped records with the fields expected by the evaluation utility, including `confidence`, a binary relevance `label`, and ranking fields. It must contain only job-related labels and must not contain protected or sensitive traits.

```bash
cd backend
PYTHONPATH=. python -m app.cli.fit_calibrator \
  /secure-data/representative-labels.jsonl \
  /secure-models/confidence-calibration.json \
  --dataset-version 2026-09-reviewed-v1
```

Review ranking quality, calibration error, coverage, subgroup validity using lawfully collected audit data, and failure cases with qualified humans. Mount the approved artifact read-only, set `CALIBRATION_MODEL_PATH`, then set `REQUIRE_CALIBRATED_MODEL=true`. Production startup fails if enforcement is enabled but the artifact is missing.

## 9. Updates and rollback

Deploy immutable commit tags. For an update: build, back up, run migrations, start services, perform the workflow smoke test, and monitor. Application containers can be rolled back to the previous image. Database rollback must follow a reviewed forward-fix or a separately tested recovery procedure; never run destructive SQL automatically.

## Decision boundary

QuickHire may organize and summarize job-related evidence. It cannot autonomously reject, shortlist, offer, hire, or change an application stage. Interview feedback uses editable answer text only. Optional audio creates text and is discarded before evaluation. The system cannot evaluate appearance, voice, accent, emotion, personality, disability, honesty, or protected/sensitive traits.
