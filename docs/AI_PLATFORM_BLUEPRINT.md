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

1. Secure platform foundation and core ATS
2. Resume and job-description normalization
3. Hybrid retrieval and EvidenceGraph scoring
4. Adaptive tests and isolated coding assessment
5. Structured AI mock interviews
6. Candidate and recruiter copilots
7. Model monitoring, drift, fairness, appeals and publication evaluation

