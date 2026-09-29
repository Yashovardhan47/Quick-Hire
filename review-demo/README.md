# QuickHire interactive review demo

This directory is the source of the deployed QuickHire review application:

https://quickhire-evidencegraph-demo.kummarayashovardhan.chatgpt.site

It mirrors the public product experience with isolated sample data so reviewers can inspect the Job Seeker, Recruiter and Platform Admin perspectives without production credentials or candidate records.

## Review behavior

- The selected signup perspective is locked for the session.
- Navigation and workflows are restricted to that role.
- Cross-role URLs return the reviewer to the authorized workspace.
- Another perspective requires exiting the current workspace and selecting again.
- Admin is invitation-only in production; the review build exposes an isolated admin perspective for inspection.
- The narrated 24-second product overview and captions are stored in `public/`.
- Demo state remains in the browser and never represents a production account.

The real API-backed application remains in `frontend/` and `backend/`. It implements short-lived JWT access tokens, rotating HTTP-only refresh sessions, backend-verified Google identity, server-side RBAC, persistent PostgreSQL data and the production AI workflows.

## Run locally

```bash
npm ci
npm run dev
```

The checked-in `.env.production` enables isolated demo mode for production builds. Build it with:

```bash
npm run build
```

GitHub Actions builds this directory independently from the production frontend to prevent the published review experience from drifting away from the repository.
