# QuickHire AI Platform Blueprint

## Product thesis

QuickHire is an evidence-driven recruitment workflow for candidates, recruiters and platform administrators. Its primary research component is an uncertainty-aware EvidenceGraph that maps every job requirement to candidate evidence and identifies what is verified, missing or contradictory.

## Decision boundary

The platform may retrieve, summarize, score job-related evidence and recommend a next action. It must not autonomously reject, shortlist or hire a person. A human reviewer owns every consequential decision and their override reason is recorded.

The system must not infer or score protected or sensitive traits, facial expressions, emotion, accent, disability, personality, honesty or medical information. AI interview analysis is limited to the content of an answer against a disclosed job-related rubric. Candidates receive notice, explanation, correction and accommodation paths.

## Core workflow

1. A recruiter creates a job and converts its description into weighted competencies.
2. A candidate uploads a resume and adds projects, skills and preferences.
3. The EvidenceGraph links each competency to supporting evidence.
4. Hybrid retrieval finds likely matches; the evidence scorer calculates coverage and confidence.
5. Weak but important claims trigger an optional targeted test or structured interview question.
6. New verified evidence recalculates the recommendation in real time.
7. The recruiter reviews the evidence matrix and records a human decision.
8. The candidate sees the reason, gaps and a counterfactual improvement plan.

## Research hypothesis

An uncertainty-aware EvidenceGraph with adaptive verification will improve ranking relevance and explanation quality while reducing unsupported recommendations compared with keyword and embedding-only baselines.

## Evaluation

- Ranking: Recall@K, NDCG@K and Mean Reciprocal Rank
- Confidence: Brier score and expected calibration error
- Evidence: requirement coverage and citation correctness
- Workflow: time to qualified review and recruiter override rate
- Fairness audit: selection-rate and error-rate comparisons on isolated audit data
- Safety: protected-feature exclusion, prompt-injection tests and explanation fidelity

Protected attributes may be used only in separated, access-controlled audit datasets and never as ranking features.

## Delivery stages

1. **Implemented:** secure platform foundation, role isolation and core ATS
2. **Implemented baseline:** resume and job-description normalization with controlled competencies
3. **Implemented baseline:** EvidenceGraph scoring, uncertainty and counterfactual recommendations
4. **Implemented baseline:** adaptive objective tests; isolated coding sandbox remains planned
5. **Implemented baseline:** structured typed mock interviews with disclosed content rubrics
6. **Implemented baseline:** grounded candidate next actions and recruiter review assistance
7. **Implemented 0.3 foundation:** secure resume files, multilingual vector retrieval, optional embedding/cross-encoder adapters, provenance and abstention
8. **Next:** fit confidence on a representative labeled dataset and replace baseline weights only when evaluation improves
9. **Next:** isolated coding assessments, interview scheduling, communication, appeals and accommodations
10. **Before production:** model validation, drift, penetration testing and independent fairness audits

## 0.4 authentication and enforcement

- Access JWTs are short-lived and constrained by token type, issuer and audience.
- Opaque refresh credentials rotate on every use, are stored only as SHA-256 digests and revoke the active session family if an already-rotated token is replayed.
- Google ID tokens are verified on the backend and linked by Google's stable subject identifier. Matching an email alone never links an existing account.
- Candidate and recruiter accounts may use Google; platform administrators cannot be created or linked through Google.
- Prohibited criteria are blocked at structured input routes and removed again before matching, including before optional external model calls.
- Recruiter pipeline transitions require explicit job-evidence review, human confirmation and a reason stored in stage history and the audit log.

## 0.2 workflow architecture

- `talent_intelligence.py` normalizes resume and job text into a controlled skill taxonomy. Resume claims are unverified until supported by platform or human-reviewed evidence.
- `evidence_graph.py` connects weighted job requirements to evidence and returns fit, confidence, an uncertainty interval, gaps and next-best verification actions.
- `assessment_engine.py` selects objective questions for low-coverage competencies. Unknown competencies are routed to human review and excluded from automated scores.
- `interview_engine.py` creates structured questions and checks typed answers for disclosed context, action, result and reflection criteria. Output is practice feedback and requires human review.
- `application_workflow.py` enforces valid pipeline transitions. Every recruiter transition records a reason, stage-history row and audit event.
- Authenticated WebSockets notify the relevant user after committed workflow events.

## Accuracy roadmap

The 0.3 hybrid baseline is deliberately testable and explainable. Higher accuracy should be added through measured replacements, not opaque assumptions:

1. Add an isolated OCR and malware-scanning worker for image-only resumes.
2. Benchmark configured multilingual embedding and cross-encoder models against the local vector baseline.
3. Fit and version confidence calibration on a representative, time-separated validation set.
4. Compare keyword, embedding-only and EvidenceGraph variants using NDCG@K, Brier score, citation accuracy and recruiter override rate.
5. Add a sandboxed coding service with fixed tests, resource limits and no network access.
6. Publish data lineage, subgroup error analysis and candidate recourse results before consequential deployment.

## 0.3 hybrid retrieval

The default local path creates a privacy-preserving hashed feature vector from Unicode words, adjacent word features and canonical multilingual skill aliases. It blends three visible signals: structured EvidenceGraph coverage, vector similarity and a cross-feature reranker. This path is deterministic and works without sending candidate data outside the deployment.

Deployments may opt into compatible external embedding and cross-encoder endpoints. External processing is off by default, requires an explicit feature flag and falls back to the local path on provider failure. Provider output can influence ordering, but it cannot remove missing mandatory evidence, convert unverified claims into verified evidence or make an employment decision.

Confidence is not described as calibrated until a labeled validation set exists. Low-evidence cases abstain, other cases show an uncertainty interval and confidence state, and the offline evaluation command reports ranking quality, probability error and coverage.
