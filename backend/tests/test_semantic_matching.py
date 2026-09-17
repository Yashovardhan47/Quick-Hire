from types import SimpleNamespace

import pytest

from app.services.evidence_graph import EvidenceItem
from app.services import semantic_matching
from app.services.semantic_matching import calculate_configured_hybrid_match, calculate_hybrid_match, cosine_similarity, feature_hash_embedding


def test_multilingual_aliases_share_vector_features() -> None:
    hindi = feature_hash_embedding("मशीन लर्निंग और डेटा विश्लेषण")
    english = feature_hash_embedding("machine learning and data analysis")

    assert cosine_similarity(hindi, english) > 0


def test_hybrid_match_exposes_provenance_and_abstains_without_evidence() -> None:
    requirements = [{"name": "Python", "weight": 2, "mandatory": True}]
    supported = calculate_hybrid_match(
        "Build Python data services.",
        requirements,
        ["Python"],
        [EvidenceItem("Python", "Passed Python assessment", 0.95, 0.95, True, "assessment:123")],
    )
    unsupported = calculate_hybrid_match("Build Python data services.", requirements, [], [])

    assert supported.ranking_features["structured_evidence"] > 80
    assert supported.evidence_citations[0].source_uri == "assessment:123"
    assert supported.retrieval_mode == "local_multilingual_feature_hash"
    assert unsupported.abstained is True
    assert unsupported.recommendation == "evidence_missing"


@pytest.mark.asyncio
async def test_external_provider_is_never_called_without_candidate_consent(monkeypatch) -> None:
    async def unexpected(*_args, **_kwargs):
        raise AssertionError("external provider must not be called")

    monkeypatch.setattr(semantic_matching, "embedding_similarity", unexpected)
    monkeypatch.setattr(semantic_matching, "cross_encoder_score", unexpected)
    settings = SimpleNamespace(
        external_model_data_processing_enabled=True,
        ai_api_key="test-provider-key",
        embedding_api_url="https://models.example.test/embeddings",
        embedding_model="embedding-model",
        reranker_api_url="https://models.example.test/rerank",
        reranker_model="reranker-model",
        ai_request_timeout_seconds=1,
        calibration_model_path=None,
    )
    result = await calculate_configured_hybrid_match(
        "Build Python services.",
        [{"name": "Python", "weight": 1, "mandatory": True}],
        ["Python"],
        [EvidenceItem("Python", "Built an API", 0.8, 0.8, True)],
        settings,
        external_processing_allowed=False,
    )
    assert result.retrieval_mode == "local_no_external_consent"
