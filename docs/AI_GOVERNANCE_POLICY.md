# QuickHire employment-AI policy 0.5

## Enforced decision boundary

QuickHire AI may retrieve, structure, compare and summarize job-related evidence. It cannot change an application stage. A signed-in recruiter who owns the job must review the evidence, explicitly confirm human ownership, explicitly confirm evidence review and provide a job-related reason before the API accepts a stage change.

This applies to review, assessment, interview, rejection, offer and hiring stages. Stage history records the human confirmation and decision source; the audit log records the same controls.

## Prohibited evaluation signals

The platform blocks or removes criteria related to:

- Appearance, photographs, faces, eye contact, body language and biometrics
- Voice, accent and speech characteristics
- Emotion, sentiment, personality, temperament and inferred culture fit
- Honesty, deception, truthfulness and lie detection
- Age and date of birth
- Sex, gender, pregnancy and sexual orientation
- Race, ethnicity, caste and skin colour
- Religion and belief
- Disability, medical, health and genetic information
- Family and marital status
- Nationality, national origin, citizenship and immigration status

Candidate free-form resume input is accepted so job-related evidence can still be extracted, but sensitive text is scrubbed from retained evidence excerpts. Structured job, ranking-profile and manually entered evidence fields reject prohibited criteria. Matching filters legacy records again before both local feature generation and any enabled external model request.

The privacy-preserving local EvidenceGraph path is the default. Even when an operator configures an approved external embedding or reranking provider, candidate evidence stays local unless that candidate has granted the current versioned external-processing consent. The candidate can revoke consent from the account workspace; active matches are then recalculated locally.

## Interview and assessment behavior

Mock interviews accept typed answers only. Questions come only from remaining job-related competencies. Feedback measures the disclosed structure of the answer—context, action, result and reflection—and always requires human interpretation. The platform has no path for camera, microphone, facial, vocal, emotional, personality, disability or honesty analysis.

Objective assessment answers can add competency evidence. Questions outside the controlled bank are saved for human review and do not change the automated score.

## Verification

Candidate correction, appeal, accommodation, export and deletion requests are stored in an admin-restricted workflow and are never passed to matching, assessment or interview engines. The recruiter assistant is advisory-only and has no stage-mutation capability.

Automated tests cover prohibited-signal detection, defense-in-depth ranking sanitation, safe interview generation, explicit human-confirmation requirements, access-token type separation, refresh/action-token hashing, Google-claim validation, notification outbox behavior and malware-scanner protocol handling. The live policy is available to platform administrators through `GET /api/v1/admin/ai-policy`.
