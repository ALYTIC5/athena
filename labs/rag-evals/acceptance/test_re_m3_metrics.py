"""re-m3: the metrics command (CONTRACT.md section 7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import support

METRICS = ("recall@5", "recall@10", "mrr")
TOY_RUN = support.FIXTURES / "toy_run.jsonl"
TOY_QRELS = support.FIXTURES / "toy_qrels.jsonl"
UNIFORM_RUN = support.FIXTURES / "uniform_run.jsonl"
UNIFORM_QRELS = support.FIXTURES / "uniform_qrels.jsonl"


def run_metrics(run: Path, qrels: Path, seed: int = 0):
    return support.run_command(
        support.metrics_command(),
        ["--run", str(run), "--qrels", str(qrels), "--seed", str(seed)],
    )


def metrics_json(run: Path, qrels: Path, seed: int = 0) -> dict[str, Any]:
    result = run_metrics(run, qrels, seed)
    assert result.returncode == 0, f"metrics exited with {result.returncode}. stderr:\n{result.stderr[-800:]}"
    try:
        out = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise AssertionError(
            f"stdout must be exactly one JSON object (send logs to stderr): {error}\nstdout began: {result.stdout[:300]!r}"
        ) from error
    assert isinstance(out, dict), "stdout must be one JSON object"
    return out


def metric(out: dict[str, Any], name: str) -> dict[str, Any]:
    metrics = out.get("metrics")
    assert isinstance(metrics, dict) and name in metrics, f"`metrics` must contain {name!r}"
    entry = metrics[name]
    assert isinstance(entry, dict), f"metrics[{name!r}] must be an object"
    assert isinstance(entry.get("value"), (int, float)), f"metrics[{name!r}].value must be a number"
    interval = entry.get("ci95")
    assert isinstance(interval, list) and len(interval) == 2, f"metrics[{name!r}].ci95 must be [low, high]"
    assert all(isinstance(x, (int, float)) for x in interval), f"metrics[{name!r}].ci95 must hold numbers"
    return entry


def test_toy_values_match_the_hand_worked_numbers():
    expected = json.loads((support.FIXTURES / "toy_expected.json").read_text(encoding="utf-8"))
    out = metrics_json(TOY_RUN, TOY_QRELS)
    assert out.get("n_queries") == expected["n_queries"], (
        f"n_queries should count the queries in qrels ({expected['n_queries']}), got {out.get('n_queries')}"
    )
    for name in METRICS:
        got = metric(out, name)["value"]
        want = expected["values"][name]
        assert abs(got - want) < 1e-5, f"{name}: expected {want}, got {got}"


def test_the_seed_is_echoed():
    assert metrics_json(TOY_RUN, TOY_QRELS, seed=5).get("seed") == 5


def test_intervals_are_sensible():
    out = metrics_json(TOY_RUN, TOY_QRELS)
    for name in METRICS:
        entry = metric(out, name)
        low, high = entry["ci95"]
        assert 0 <= low <= entry["value"] <= high <= 1, (
            f"{name}: need 0 <= low <= value <= high <= 1, got {low}, {entry['value']}, {high}"
        )
        assert high > low, f"{name}: the toy queries differ, so the interval cannot be a single number"


def test_the_same_seed_gives_identical_output():
    first = run_metrics(TOY_RUN, TOY_QRELS, seed=3)
    second = run_metrics(TOY_RUN, TOY_QRELS, seed=3)
    assert first.returncode == 0 and second.returncode == 0
    assert first.stdout == second.stdout, "two runs with the same inputs and seed must print the same bytes"


def test_the_interval_collapses_when_every_query_scores_the_same():
    out = metrics_json(UNIFORM_RUN, UNIFORM_QRELS)
    for name in METRICS:
        entry = metric(out, name)
        assert entry["value"] == 1, f"{name}: every query finds its answer first, so the value is 1"
        assert entry["ci95"] == [1, 1], f"{name}: identical queries must give a single-number interval, got {entry['ci95']}"


def test_a_qrels_query_missing_from_the_run_is_an_error(tmp_path):
    lines = TOY_RUN.read_text(encoding="utf-8").splitlines()
    short = tmp_path / "short_run.jsonl"
    short.write_text("\n".join(line for line in lines if '"t3"' not in line) + "\n", encoding="utf-8")
    result = run_metrics(short, TOY_QRELS)
    assert result.returncode == 2, f"a missing run query must exit with code 2, got {result.returncode}"
    assert result.stdout.strip() == "", "an error must not print JSON on stdout"
    assert result.stderr.strip(), "an error must explain itself on stderr"
