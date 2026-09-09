import math

import httpx


class ModelProviderError(RuntimeError):
    pass


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
