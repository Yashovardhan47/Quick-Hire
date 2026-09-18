from fastapi.testclient import TestClient

from app.main import app


def test_health_is_public_but_models_require_private_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_WORKER_TOKEN", "private-test-token")
    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["decision_authority"] == "none"

    denied = client.post("/embeddings", json={"model": "unused", "input": ["Python"]})
    assert denied.status_code == 401
    wrong = client.post(
        "/rerank",
        headers={"Authorization": "Bearer wrong"},
        json={"model": "unused", "query": "Python", "documents": ["Python API"], "top_n": 1},
    )
    assert wrong.status_code == 401
