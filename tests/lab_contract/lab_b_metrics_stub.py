"""A stand-in for a learner's `metrics.py`, used to test the Lab B metrics suite.

It follows CONTRACT.md section 7. LAB_B_FLAWS makes it wrong: recall_over_k, unseeded, missing_ok,
no_collapse, count_run_queries, mrr_cap.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys

flaws = {f for f in os.environ.get("LAB_B_FLAWS", "").split(",") if f}
RESAMPLES = 1000


def read(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle.read().splitlines()]


def recall_at(k: int, ranked: list[str], relevant: list[str]) -> float:
    found = len(set(ranked[:k]) & set(relevant))
    return found / (k if "recall_over_k" in flaws else len(relevant))


def reciprocal_rank(ranked: list[str], relevant: list[str]) -> float:
    limit = 5 if "mrr_cap" in flaws else len(ranked)
    for position, item in enumerate(ranked[:limit], start=1):
        if item in relevant:
            return 1 / position
    return 0.0


def percentile(sorted_values: list[float], fraction: float) -> float:
    index = fraction * (len(sorted_values) - 1)
    low = int(index)
    high = min(low + 1, len(sorted_values) - 1)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (index - low)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--qrels", required=True)
    parser.add_argument("--seed", type=int, required=True)
    args = parser.parse_args()

    run_rows = read(args.run)
    run = {row["query_id"]: row["ranked_ids"] for row in run_rows}
    qrels = {row["query_id"]: row["relevant_ids"] for row in read(args.qrels)}
    missing = sorted(q for q in qrels if q not in run)
    if missing and "missing_ok" not in flaws:
        print(f"no run line for: {missing}", file=sys.stderr)
        return 2

    per_query: dict[str, list[float]] = {"recall@5": [], "recall@10": [], "mrr": []}
    for query_id, relevant in qrels.items():
        ranked = run.get(query_id, [])
        per_query["recall@5"].append(recall_at(5, ranked, relevant))
        per_query["recall@10"].append(recall_at(10, ranked, relevant))
        per_query["mrr"].append(reciprocal_rank(ranked, relevant))

    rng = random.Random() if "unseeded" in flaws else random.Random(args.seed)
    n = len(qrels)
    metrics = {}
    for name, scores in per_query.items():
        means = []
        for _ in range(RESAMPLES):
            sample = [scores[rng.randrange(n)] for _ in range(n)]
            means.append(sum(sample) / n)
        means.sort()
        low, high = percentile(means, 0.025), percentile(means, 0.975)
        if "no_collapse" in flaws:
            low, high = max(0.0, low - 0.05), min(1.0, high + 0.05)
        value = sum(scores) / n
        metrics[name] = {"value": round(value, 6), "ci95": [round(low, 6), round(high, 6)]}

    out = {"n_queries": len(run_rows) if "count_run_queries" in flaws else n, "seed": args.seed, "metrics": metrics}
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
