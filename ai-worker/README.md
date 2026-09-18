# Optional private neural worker

This isolated service provides the presentation's concrete Sentence Transformers, cross-encoder and Whisper capabilities without placing heavy ML dependencies in the public API image.

It exposes OpenAI-compatible embedding and transcription response shapes plus a reranking endpoint. The QuickHire backend remains the only caller. Set the same private token as `AI_WORKER_TOKEN` in this service and `AI_API_KEY` in the backend.

Recommended internal endpoints:

```env
EMBEDDING_API_URL=http://ai-worker:8100/embeddings
RERANKER_API_URL=http://ai-worker:8100/rerank
TRANSCRIPTION_API_URL=http://ai-worker:8100/audio/transcriptions
```

Model downloads require storage, memory and an explicit deployment review. Audio exists only in a bounded temporary file during transcription and is deleted before the response returns. The worker has no access to application stages and cannot make employment decisions.
