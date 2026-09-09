import argparse
import json
from pathlib import Path

from app.services.ranking_evaluation import evaluate_rankings


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate QuickHire ranking and confidence from labeled JSONL data.")
    parser.add_argument("dataset", type=Path, help="JSONL rows with query_id, label, score and confidence")
    parser.add_argument("--k", type=int, default=10, help="Ranking cutoff for NDCG")
    args = parser.parse_args()
    records = [json.loads(line) for line in args.dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(json.dumps(evaluate_rankings(records, k=args.k), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
