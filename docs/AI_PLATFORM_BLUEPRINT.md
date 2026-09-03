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
7. **Next:** embedding retrieval, calibrated reranking and resume file ingestion
8. **Next:** interview scheduling, communication, appeals and accommodations
9. **Before production:** representative evaluation dataset, model cards, drift, security and independent fairness audits

## 0.2 workflow architecture

- `talent_intelligence.py` normalizes resume and job text into a controlled skill taxonomy. Resume claims are unverified until supported by platform or human-reviewed evidence.
- `evidence_graph.py` connects weighted job requirements to evidence and returns fit, confidence, an uncertainty interval, gaps and next-best verification actions.
- `assessment_engine.py` selects objective questions for low-coverage competencies. Unknown competencies are routed to human review and excluded from automated scores.
- `interview_engine.py` creates structured questions and checks typed answers for disclosed context, action, result and reflection criteria. Output is practice feedback and requires human review.
- `application_workflow.py` enforces valid pipeline transitions. Every recruiter transition records a reason, stage-history row and audit event.
- Authenticated WebSockets notify the relevant user after committed workflow events.

## Accuracy roadmap

The deterministic 0.2 baseline is deliberately testable and explainable. Higher accuracy should be added as a measured hybrid, not as an opaque replacement:

1. Parse PDFs and DOCX files in an isolated ingestion worker with prompt-injection and malware defenses.
2. Retrieve competencies with multilingual embeddings, then rerank only job-related evidence with a cross-encoder.
3. Calibrate confidence on a representative validation set and abstain when evidence is sparse or out of distribution.
4. Compare keyword, embedding-only and EvidenceGraph variants using NDCG@K, Brier score, explanation citation accuracy and recruiter override rate.
5. Add a sandboxed coding service with fixed tests, resource limits and no network access.
6. Publish model cards, data lineage, subgroup error analysis and candidate recourse results before consequential deployment.
