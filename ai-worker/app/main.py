import math
import os
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field


app = FastAPI(
    title="QuickHire private neural model worker",
    version="0.6.0",
    description="Optional private embeddings, cross-encoder reranking and speech-to-text. No employment decisions.",
)


def require_worker_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_WORKER_TOKEN", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid worker credential")


class EmbeddingRequest(BaseModel):
    model: str | None = None
    input: list[str] = Field(min_length=1, max_length=32)


class RerankRequest(BaseModel):
    model: str | None = None
    query: str = Field(min_length=1, max_length=50_000)
    documents: list[str] = Field(min_length=1, max_length=100)
    top_n: int = Field(default=10, ge=1, le=100)


@lru_cache(maxsize=2)
def embedding_model(model_name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


@lru_cache(maxsize=2)
def reranker_model(model_name: str):
    from sentence_transformers import CrossEncoder

    return CrossEncoder(model_name)


@lru_cache(maxsize=2)
def whisper_model(model_name: str):
    from faster_whisper import WhisperModel

    return WhisperModel(
        model_name,
        device=os.getenv("WHISPER_DEVICE", "cpu"),
        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "decision_authority": "none", "audio_retention": "none"}


@app.post("/embeddings", dependencies=[Depends(require_worker_token)])
async def embeddings(payload: EmbeddingRequest) -> dict:
    model_name = payload.model or os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    )
    vectors = embedding_model(model_name).encode(
        payload.input,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return {
        "object": "list",
        "model": model_name,
        "data": [
            {"object": "embedding", "index": index, "embedding": vector.tolist()}
            for index, vector in enumerate(vectors)
        ],
    }


@app.post("/rerank", dependencies=[Depends(require_worker_token)])
async def rerank(payload: RerankRequest) -> dict:
    model_name = payload.model or os.getenv(
        "RERANKER_MODEL",
        "cross-encoder/ms-marco-MiniLM-L-6-v2",
    )
    raw_scores = reranker_model(model_name).predict(
        [(payload.query, document) for document in payload.documents]
    )
    ranked = sorted(
        (
            {
                "index": index,
                "relevance_score": 1.0 / (1.0 + math.exp(-max(-60.0, min(60.0, float(score))))),
                "document": {"text": payload.documents[index]},
            }
            for index, score in enumerate(raw_scores)
        ),
        key=lambda item: item["relevance_score"],
        reverse=True,
    )[: payload.top_n]
    return {"model": model_name, "results": ranked}


@app.post("/audio/transcriptions", dependencies=[Depends(require_worker_token)])
async def transcriptions(
    file: UploadFile = File(...),
    model: str | None = Form(default=None),
    response_format: str = Form(default="json"),
) -> dict:
    if response_format != "json":
        raise HTTPException(status_code=422, detail="Only JSON transcription responses are supported")
    media_type = (file.content_type or "").lower()
    if media_type not in {"audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/ogg"}:
        raise HTTPException(status_code=422, detail="Unsupported audio format")
    maximum = int(os.getenv("MAX_AUDIO_BYTES", "10485760"))
    audio = await file.read(maximum + 1)
    if not audio or len(audio) > maximum:
        raise HTTPException(status_code=413, detail="Audio is empty or exceeds the configured limit")
    suffix = Path(file.filename or "answer.webm").suffix[:10] or ".webm"
    path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(audio)
            path = temporary.name
        requested_model = model or os.getenv("TRANSCRIPTION_MODEL", "small")
        model_name = os.getenv("WHISPER_LOCAL_MODEL", "small") if requested_model == "whisper-1" else requested_model
        segments, _ = whisper_model(model_name).transcribe(path, vad_filter=True, beam_size=3)
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())[:20_000]
        if not text:
            raise HTTPException(status_code=422, detail="No speech could be transcribed")
        return {"text": text, "model": model_name, "audio_retained": False}
    finally:
        if path:
            Path(path).unlink(missing_ok=True)
