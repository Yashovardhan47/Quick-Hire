# Research novelty after the 0.6 implementation

## Central contribution

The research contribution remains **QuickHire EvidenceGraph: uncertainty-aware candidate-job matching with adaptive skill verification**.

RAG, voice access, neural embeddings and specialist agents are supporting components. They improve the application and create stronger baselines, but they are not claimed as new algorithms.

The complete research mechanism is:

1. Map each job requirement to candidate evidence and provenance.
2. Estimate evidence coverage, confidence and uncertainty.
3. Abstain when evidence is insufficient.
4. Retrieve the most relevant evidence for a targeted assessment or structured interview.
5. Add newly verified evidence and recalculate the match.
6. Preserve human authority for every employment-stage decision.

## Publication hypotheses

- **H1:** EvidenceGraph plus adaptive verification improves NDCG and MRR compared with keyword, embedding-only and ordinary RAG ranking.
- **H2:** Citation-grounded verification reduces unsupported match explanations and improves citation correctness.
- **H3:** Calibrated uncertainty and abstention reduce high-confidence ranking errors at an acceptable coverage level.
- **H4:** Counterfactual skill-gap actions improve candidate understanding without increasing recruiter decision automation.

## Required experiment

Compare five fixed variants on a representative, time-separated and human-reviewed dataset:

1. Keyword baseline
2. Sentence-transformer similarity
3. Embedding plus RAG
4. EvidenceGraph without adaptive verification
5. Full EvidenceGraph with RAG verification, calibration and abstention

Report NDCG@K, MRR, Brier score, expected calibration error, selective risk, coverage, citation correctness and recruiter override rate. Use confidence intervals and a documented significance test. Run subgroup error audits in an isolated governance dataset; protected attributes must never enter ranking features.

Voice transcription belongs in an accessibility or usability study only. Audio must never become a ranking feature.

## Acceptance boundary

Feature completeness cannot guarantee publication acceptance. A credible submission needs a clearly scoped contribution, related-work comparison, reproducible data protocol, ablations, measured gains, limitations and an ethics section. Adding common platform features does not weaken the novelty when the paper treats them as infrastructure. Claiming every component as novel would weaken the paper.
