"""A stand-in for a learner's `search.py`, used to test the Lab B search suite.

It is a plain BM25 keyword ranking over data/memories.jsonl for both modes. That also shows the
re-m1 threshold is reachable without any model (see test_lab_b_suites.py). LAB_B_FLAWS makes it wrong:
foreign_ids, ignore_k, ascending_scores, duplicate_ids, accepts_any_mode, stdout_noise, random_order, poor_recall.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "labs" / "rag-evals" / "data" / "memories.jsonl"
STOP = {
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "by", "is", "are", "was", "with", "who",
    "that", "so", "at", "as", "it", "his", "her", "their", "from", "not", "after", "about", "because", "be",
}
flaws = {f for f in os.environ.get("LAB_B_FLAWS", "").split(",") if f}


def tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP]


def rank(query: str, rows: list[dict]) -> list[tuple[str, float]]:
    docs = [tokens(r["text"]) for r in rows]
    df = Counter(w for d in docs for w in set(d))
    n = len(docs)
    avg = sum(map(len, docs)) / n
    scored = []
    for row, doc in zip(rows, docs):
        tf = Counter(doc)
        score = 0.0
        for w in set(tokens(query)):
            if w in tf:
                idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
                score += idf * tf[w] * 2.2 / (tf[w] + 1.2 * (0.25 + 0.75 * len(doc) / avg))
        scored.append((row["id"], score))
    return sorted(scored, key=lambda pair: (-pair[1], pair[0]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--k", type=int, required=True)
    parser.add_argument("--mode", required=True)
    args = parser.parse_args()
    if args.k < 1:
        print("--k must be at least 1", file=sys.stderr)
        return 2
    if args.mode not in ("vector", "hybrid") and "accepts_any_mode" not in flaws:
        print(f"unknown mode {args.mode!r}", file=sys.stderr)
        return 2

    rows = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines()]
    ranked = rank(args.query, rows)
    if "poor_recall" in flaws:
        ranked = [(r["id"], 1.0 - i / 1000) for i, r in enumerate(rows)]
    k = max(args.k, 5) if "ignore_k" in flaws else args.k
    top = ranked[:k]
    if "random_order" in flaws:
        ids = [i for i, _ in top]
        random.shuffle(ids)
        top = [(i, s) for i, (_, s) in zip(ids, top)]
    results = [{"id": i, "score": round(s, 6)} for i, s in top]
    if "foreign_ids" in flaws:
        results[-1]["id"] = "mem_9999"
    if "duplicate_ids" in flaws and len(results) > 1:
        results[1]["id"] = results[0]["id"]
    if "ascending_scores" in flaws:
        results = [{"id": r["id"], "score": s} for r, s in zip(results, sorted(r["score"] for r in results))]
    if "stdout_noise" in flaws:
        print("loading model...")
    print(json.dumps({"query": args.query, "mode": args.mode, "k": args.k, "results": results}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
