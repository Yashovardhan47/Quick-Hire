# AI HR Recruitment Simulator presentation coverage

This matrix maps the presentation concepts to QuickHire 0.6. Example products listed in the slides are alternatives, so the implementation selects one production path instead of adding redundant databases and orchestration frameworks.

| Presentation concept | QuickHire implementation | Evidence |
| --- | --- | --- |
| Registration | Password/JWT, rotating refresh sessions and backend-verified Google Identity | `app/api/routes/auth.py` |
| Resume upload | Validated PDF, DOCX and TXT ingestion with malware scanning | `document_ingestion.py`, `intelligence.py` |
| NLP parsing | Controlled multilingual skills, experience, projects, education and degree entities | `talent_intelligence.py` |
| Job matching | EvidenceGraph plus semantic similarity, reranking, uncertainty and abstention | `evidence_graph.py`, `semantic_matching.py` |
| Neural embeddings | Optional private Sentence Transformers worker or approved compatible endpoint | `ai-worker/app/main.py` |
| Vector database | PostgreSQL `pgvector`, bounded chunks and HNSW cosine indexes | migration `0006_rag_agents_voice.sql` |
| RAG | Sanitized job/resume retrieval, grounded questions and source citations | `knowledge_retrieval.py`, `rag_agents.py` |
| LLM and prompting | Compatible JSON-only model adapter with untrusted-context and employment-policy boundaries | `model_providers.py`, `rag_agents.py` |
| Resume agent | Parsing, evidence persistence, vector indexing and active-match refresh | `intelligence.py` |
| Retrieval agent | Candidate/job vector retrieval with local fallback | `knowledge_retrieval.py` |
| Interview agent | Dynamic provider-backed or deterministic grounded questions | `rag_agents.py` |
| Evaluation agent | Answer-text-only grounded evaluation with human review | `rag_agents.py` |
| Voice AI | Browser TTS and optional Whisper-compatible transcription; audio discarded | `voice.py`, `CandidateInterview.tsx` |
| HR Copilot | Natural-language, read-only search and evidence summaries for recruiter-owned jobs | `recruiter_copilot.py` |
| Dashboards | Candidate, recruiter and platform-admin React workspaces | `frontend/src/pages` |
| Deployment | FastAPI, React, PostgreSQL, Redis, ClamAV, containers, TLS and CI | production Compose and deployment runbook |

## Deliberate technology choices

- PostgreSQL with `pgvector` replaces the slide's alternative list of ChromaDB, Pinecone and FAISS. Running several vector stores would add operational risk without improving the research question.
- Typed Python services and Pydantic validation replace LangChain. The smaller orchestration surface makes agent permissions, citations and failure behavior easier to audit.
- The model gateway accepts OpenAI-compatible chat, embedding and transcription shapes. Deployments can route approved GPT, Gemini, Claude, Llama or local services through reviewed compatible gateways.
- The React interface retains its existing custom design system. Tailwind is a styling option, not a recruitment capability.

RAG reduces unsupported generation by providing context and citations. It does not eliminate hallucinations.
