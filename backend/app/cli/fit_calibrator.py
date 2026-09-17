import argparse
import json
from pathlib import Path

from app.services.confidence_calibration import fit_histogram_calibrator
from app.services.ranking_evaluation import evaluate_rankings


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit a versioned QuickHire confidence calibrator from labeled JSONL data.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--bins", type=int, default=10)
    parser.add_argument("--dataset-version", required=True)
    args = parser.parse_args()
    records = [json.loads(line) for line in args.dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    artifact = fit_histogram_calibrator(records, bins=args.bins)
    artifact["dataset_version"] = args.dataset_version
    artifact["evaluation"] = evaluate_rankings(records)
    args.output.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output} from {len(records)} labeled records")


if __name__ == "__main__":
    main()
