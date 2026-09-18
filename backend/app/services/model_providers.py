import json
import math
import re
from typing import Any

import httpx


class ModelProviderError(RuntimeError):
    pass


def _json_object(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        raise ModelProviderError("Language model returned an unsupported response")
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", value.strip(), flags=re.IGNORECASE)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ModelProviderError("Language model did not return valid JSON") from exc
    if not isinstance(parsed, dict):
        raise ModelProviderError("Language model response must be a JSON object")
    return parsed


async def llm_json_completion(
    endpoint: str,
    model: str,
    api_key: str,
    *,
    system_prompt: str,
    user_prompt: str,
    timeout_seconds: float,
    max_tokens: int = 1_200,
) -> dict:
    """Call an OpenAI-compatible chat endpoint and require a bounded JSON object."""
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "temperature": 0,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
        )
        response.raise_for_status()
    payload = response.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ModelProviderError("Language model returned no completion") from exc
    return _json_object(content)


async def transcribe_audio(
    endpoint: str,
    model: str,
    api_key: str,
    *,
    filename: str,
    media_type: str,
    audio: bytes,
    timeout_seconds: float,
) -> str:
    """Transcribe audio without storing it or exposing audio features to scoring code."""
    async with httpx.AsyncClient(timeout=max(timeout_seconds, 30.0)) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": model, "response_format": "json"},
            files={"file": (filename, audio, media_type)},
        )
        response.raise_for_status()
    transcript = str(response.json().get("text", "")).strip()
    if not transcript:
        raise ModelProviderError("Transcription provider returned no answer text")
    return transcript[:20_000]


def _cosine(left: list[float], right: list[float]) -> float:
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm or len(left) != len(right):
        raise ModelProviderError("Embedding provider returned invalid vectors")
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)))


async def embedding_similarity(
    endpoint: str,
    model: str,
    api_key: str,
    job_text: str,
    candidate_text: str,
    timeout_seconds: float,
) -> float:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "input": [job_text, candidate_text]},
        )
        response.raise_for_status()
    payload = response.json()
    rows = sorted(payload.get("data", []), key=lambda item: item.get("index", 0))
    if len(rows) != 2:
        raise ModelProviderError("Embedding provider must return two vectors")
    return _cosine(rows[0]["embedding"], rows[1]["embedding"])


async def cross_encoder_score(
    endpoint: str,
    model: str,
    api_key: str,
    job_text: str,
    candidate_text: str,
    timeout_seconds: float,
) -> float:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "query": job_text, "documents": [candidate_text], "top_n": 1},
        )
        response.raise_for_status()
    results = response.json().get("results", [])
    if not results:
        raise ModelProviderError("Reranker provider returned no result")
    score = results[0].get("relevance_score", results[0].get("score"))
    if score is None:
        raise ModelProviderError("Reranker provider returned no score")
    return max(0.0, min(1.0, float(score)))
