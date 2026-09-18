# QuickHire EvidenceGraph Model Card · RAG and agent controls 0.6

## Intended use

EvidenceGraph helps job seekers understand how their job-related evidence maps to published requirements and helps recruiters decide what evidence to review next. It may rank opportunities, summarize support, identify gaps and propose a verification action.

It is not an autonomous screening, rejection, shortlisting, offer or hiring system. A recruiter must review the underlying evidence and record a job-related reason for every consequential stage change.

## Inputs and excluded data

Ranking inputs are published job text, weighted competencies, candidate-declared skills and evidence from resumes, projects, assessments and structured interviews. Names, contact details, photographs, age, gender, ethnicity, nationality, religion, family status, health, disability and other protected or sensitive traits are excluded from ranking features.

Mock-interview feedback uses editable answer text against a disclosed rubric. Optional speech-to-text discards audio before evaluation. Voice, face, accent, emotion, personality, honesty and medical or disability inferences are prohibited.

## Model path

- Structured EvidenceGraph coverage links each requirement to matching evidence.
- The default local vectorizer feature-hashes Unicode terms, adjacent terms and canonical skill aliases into 384 dimensions.
- A cross-feature reranker combines structured coverage, vector similarity, mandatory-requirement coverage and verified-evidence density.
- Optional external multilingual embeddings and cross-encoder reranking are disabled by default and require an explicit data-processing flag.
- Low-evidence cases abstain instead of presenting a reliable-fit recommendation.
- Sanitized job and resume-evidence chunks use `pgvector` with HNSW cosine retrieval. RAG outputs carry source locators and treat every retrieved excerpt as untrusted data.
- An optional private worker supplies real Sentence Transformers embeddings, cross-encoder reranking and Whisper transcription. A deployment may instead configure reviewed compatible endpoints.
- LLM interview and evaluation output must pass schema, policy and citation validation; failures return to the disclosed local rubric.

The local vectorizer is not a trained neural embedding model. It is the reproducible offline baseline against which a configured multilingual embedding model must be evaluated.

## Evaluation requirements

Before production, evaluate on representative, time-separated job and candidate evidence with NDCG@K, MRR, Brier score, expected calibration error, abstention coverage, citation correctness and recruiter override rate. Run subgroup error analysis only in an isolated audit environment; protected attributes must never enter ranking features.

## Known limitations

- Skill aliases currently emphasize English with initial Hindi and Telugu coverage.
- Production rejects scan-only PDFs that cannot yield reliable text; OCR remains an optional future accessibility enhancement.
- Extracted resume claims remain unverified until supported by an assessment, project or human review.
- Baseline confidence is intentionally labeled uncalibrated until sufficient outcome data exists.
- Historical hiring outcomes can encode discrimination and must not be treated as ground truth without governance review.
- Production uploads are fail-closed through ClamAV before strict file parsing; independent parser/sandbox review is still required for high-risk deployments.

## Required controls

Candidate notice, consent for external processing, correction and appeal paths, accommodations, data retention and deletion, access logging, independent security review, model/version rollback and periodic drift/fairness audits are required for consequential use.

Platform release 0.5 implements input blocking, ranking sanitation, answer-text-only interview generation, human stage confirmations, durable audit/notification workflows, candidate correction/appeal/accommodation/export/deletion requests, and an administrator-readable policy manifest. Representative validation, jurisdiction-specific legal review, penetration testing, and independent audits cannot be manufactured in source code and remain launch requirements.

Release 0.6 adds vector retrieval, evidence-grounded RAG, read-only specialist agents, optional audio transcription and evaluation provenance. These additions do not constitute evidence of model quality. Publication and deployment claims still require representative labels, baseline comparisons, ablations, subgroup audits and independent review.
