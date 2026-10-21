"""re-m1: the search command (CONTRACT.md section 5)."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from typing import Any

import support

SAMPLE_QUERY = "who prefers Tuesday morning appointments"


@lru_cache(maxsize=None)
def search(query: str, k: int, mode: str) -> tuple[int, str, str]:
    result = support.run_command(
        support.search_command(), ["--query", query, "--k", str(k), "--mode", mode]
    )
    return result.returncode, result.stdout, result.stderr


def search_json(query: str, k: int, mode: str) -> dict[str, Any]:
    code, out, err = search(query, k, mode)
    assert code == 0, f"search exited with {code} for mode {mode!r}. stderr:\n{err[-800:]}"
    try:
        parsed = json.loads(out)
    except json.JSONDecodeError as error:
        raise AssertionError(
            f"stdout must be exactly one JSON object (send logs to stderr): {error}\nstdout began: {out[:300]!r}"
        ) from error
    assert isinstance(parsed, dict), "stdout must be one JSON object"
    return parsed


def test_output_matches_the_contract(mode):
    out = search_json(SAMPLE_QUERY, 10, mode)
    assert out.get("query") == SAMPLE_QUERY, "`query` must echo the --query argument"
    assert out.get("mode") == mode, "`mode` must echo the --mode argument"
    assert out.get("k") == 10 and not isinstance(out.get("k"), bool), "`k` must echo --k as a number"
    results = out.get("results")
    assert isinstance(results, list), "`results` must be a list"
    expected = min(10, len(support.corpus()))
    assert len(results) == expected, f"expected {expected} results, got {len(results)}"

    ids = []
    scores = []
    for position, item in enumerate(results, start=1):
        assert isinstance(item, dict), f"result {position} must be an object"
        assert isinstance(item.get("id"), str), f"result {position} needs a string `id`"
        score = item.get("score")
        assert isinstance(score, (int, float)) and not isinstance(score, bool), (
            f"result {position} needs a numeric `score`"
        )
        assert math.isfinite(score), f"result {position} has a score that is not a finite number"
        ids.append(item["id"])
        scores.append(score)

    unknown = [i for i in ids if i not in support.corpus_ids()]
    assert not unknown, f"ids that are not in the corpus: {unknown}"
    assert len(set(ids)) == len(ids), "an id appears more than once in `results`"
    assert all(a >= b for a, b in zip(scores, scores[1:])), (
        "scores must never increase down the list (higher is better, best first)"
    )


def test_k_is_respected(mode):
    for k in (1, 3):
        results = search_json(SAMPLE_QUERY, k, mode).get("results")
        assert isinstance(results, list) and len(results) == k, f"--k {k} must give exactly {k} results"


def test_same_arguments_give_the_same_order(mode):
    first = [r["id"] for r in search_json("allergic to shellfish", 10, mode)["results"]]
    code, out, _ = search.__wrapped__("allergic to shellfish", 10, mode)  # skip the cache: a second real run
    assert code == 0, "the second run failed"
    second = [r["id"] for r in json.loads(out)["results"]]
    assert first == second, "the same query, k and mode must give the same ids in the same order"


def test_unknown_mode_is_an_error():
    code, out, _ = search("anything", 5, "not-a-mode")
    assert code != 0, "an unknown --mode must exit with a non-zero code"
    assert out.strip() == "", "an error must not print JSON on stdout"


def test_missing_query_is_an_error():
    result = support.run_command(support.search_command(), ["--k", "5", "--mode", support.search_modes()[0]])
    assert result.returncode != 0, "a missing --query must exit with a non-zero code"
    assert result.stdout.strip() == "", "an error must not print JSON on stdout"


def test_k_below_one_is_an_error():
    result = support.run_command(
        support.search_command(), ["--query", "x", "--k", "0", "--mode", support.search_modes()[0]]
    )
    assert result.returncode != 0, "--k 0 must exit with a non-zero code"
    assert result.stdout.strip() == "", "an error must not print JSON on stdout"


def test_seed_queries_find_a_relevant_memory_in_the_top_10(mode):
    seeds = support.seed_queries()
    needed = math.ceil(0.8 * len(seeds))
    hits = 0
    misses = []
    for seed in seeds:
        ids = [r["id"] for r in search_json(seed["query"], 10, mode)["results"]]
        if set(ids) & set(seed["relevant_ids"]):
            hits += 1
        else:
            misses.append(f"{seed['query_id']}: {seed['query']!r}")
    assert hits >= needed, (
        f"mode {mode!r}: a relevant memory is in the top 10 for {hits} of {len(seeds)} seed queries, "
        f"but {needed} are needed. Misses: {misses}"
    )
