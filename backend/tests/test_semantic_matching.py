from app.services.evidence_graph import EvidenceItem
from app.services.semantic_matching import calculate_hybrid_match, cosine_similarity, feature_hash_embedding


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
