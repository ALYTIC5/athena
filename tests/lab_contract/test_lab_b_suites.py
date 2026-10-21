"""Lab B: the acceptance suites are tested against fakes, not against a real project.

Each suite must pass the correct fake and fail against several deliberately broken fakes
(docs/SPEC.md section 10). The suites run in a separate pytest process, as a learner would run them.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
LAB = HERE.parent.parent / "labs" / "rag-evals"
ACCEPTANCE = LAB / "acceptance"
DATA = LAB / "data"
SEARCH_STUB = HERE / "lab_b_search_stub.py"
METRICS_STUB = HERE / "lab_b_metrics_stub.py"


def command(script: Path) -> str:
    return f"{shlex.quote(Path(sys.executable).as_posix())} {shlex.quote(script.as_posix())}"


def run_suite(
    suite: str,
    *,
    flaws: str = "",
    project_dir: Path | None = None,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = {
        **os.environ,
        "ATHENA_PROJECT_DIR": str(project_dir or LAB),
        "ATHENA_SEARCH_COMMAND": command(SEARCH_STUB),
        "ATHENA_METRICS_COMMAND": command(METRICS_STUB),
        "ATHENA_DB_FACTORY": "lab_b_db:make_connection",
        "LAB_B_FLAWS": flaws,
        "PYTHONPATH": os.pathsep.join([str(HERE), str(ACCEPTANCE)]),
        **(extra_env or {}),
    }
    return subprocess.run(
        [sys.executable, "-m", "pytest", str(ACCEPTANCE / suite), "-q", "-p", "no:cacheprovider"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(LAB),
        timeout=300,
    )


def tail(result: subprocess.CompletedProcess[str]) -> str:
    return (result.stdout + result.stderr)[-1800:]


# ---- the data ---------------------------------------------------------------------------------


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_the_corpus_is_well_formed_and_synthetic():
    memories = read_jsonl(DATA / "memories.jsonl")
    assert len(memories) == 300
    assert len({m["id"] for m in memories}) == 300
    assert len({m["text"] for m in memories}) == 300, "two memories have identical text"
    for m in memories:
        assert set(m) == {"id", "caller_id", "caller_name", "created_at", "text"}
        assert "@" not in m["text"], "no email addresses in the corpus"
        assert not re.search(r"\d{5,}", m["text"]), "no long digit runs (phone numbers) in the corpus"


def test_the_seed_queries_are_well_formed():
    memories = {m["id"] for m in read_jsonl(DATA / "memories.jsonl")}
    seeds = read_jsonl(DATA / "queries_seed.jsonl")
    assert len(seeds) == 20
    assert len({s["query_id"] for s in seeds}) == 20
    assert len({" ".join(s["query"].lower().split()) for s in seeds}) == 20
    for s in seeds:
        assert s["relevant_ids"] and set(s["relevant_ids"]) <= memories


def test_a_plain_keyword_baseline_reaches_the_threshold_but_not_perfection():
    sys.path.insert(0, str(HERE))
    try:
        import lab_b_search_stub as stub  # noqa: PLC0415
    finally:
        sys.path.remove(str(HERE))
    memories = read_jsonl(DATA / "memories.jsonl")
    seeds = read_jsonl(DATA / "queries_seed.jsonl")
    hits = sum(
        bool({i for i, _ in stub.rank(s["query"], memories)[:10]} & set(s["relevant_ids"])) for s in seeds
    )
    assert hits >= 16, f"BM25 finds a relevant memory for only {hits} of 20 seed queries (needs 16)"
    assert hits < 20, "the seed set should leave room for a better retriever to improve"


# ---- search, database, metrics ----------------------------------------------------------------

SEARCH_FLAWS = [
    "foreign_ids",
    "ignore_k",
    "ascending_scores",
    "duplicate_ids",
    "accepts_any_mode",
    "stdout_noise",
    "random_order",
    "poor_recall",
]
DB_FLAWS = ["missing_row", "mixed_dims", "null_embedding", "wrong_ids"]
METRICS_FLAWS = ["recall_over_k", "unseeded", "missing_ok", "no_collapse", "count_run_queries", "mrr_cap"]


def test_search_suite_passes_the_correct_fake():
    result = run_suite("test_re_m1_search.py")
    assert result.returncode == 0, tail(result)


@pytest.mark.parametrize("flaw", SEARCH_FLAWS)
def test_search_suite_fails_a_broken_fake(flaw):
    result = run_suite("test_re_m1_search.py", flaws=flaw)
    assert result.returncode != 0, f"search suite should fail with the flaw {flaw!r}:\n{tail(result)}"


def test_database_suite_passes_the_correct_fake():
    result = run_suite("test_re_m1_database.py")
    assert result.returncode == 0, tail(result)


@pytest.mark.parametrize("flaw", DB_FLAWS)
def test_database_suite_fails_a_broken_fake(flaw):
    result = run_suite("test_re_m1_database.py", flaws=flaw)
    assert result.returncode != 0, f"database suite should fail with the flaw {flaw!r}:\n{tail(result)}"


def test_metrics_suite_passes_the_correct_fake():
    result = run_suite("test_re_m3_metrics.py")
    assert result.returncode == 0, tail(result)


@pytest.mark.parametrize("flaw", METRICS_FLAWS)
def test_metrics_suite_fails_a_broken_fake(flaw):
    result = run_suite("test_re_m3_metrics.py", flaws=flaw)
    assert result.returncode != 0, f"metrics suite should fail with the flaw {flaw!r}:\n{tail(result)}"


# ---- the eval set -----------------------------------------------------------------------------


def good_eval_set() -> list[dict]:
    seeds = read_jsonl(DATA / "queries_seed.jsonl")
    seeded = {i for s in seeds for i in s["relevant_ids"]}
    extra = [
        {
            "query_id": f"q{21 + n:02d}",
            "query": f"what do we know about {m['caller_name']} ({m['id']})",
            "relevant_ids": [m["id"]],
        }
        for n, m in enumerate(m for m in read_jsonl(DATA / "memories.jsonl") if m["id"] not in seeded)
        if n < 30
    ]
    return seeds + extra


def write_eval(tmp_path: Path, rows: list[dict], raw_extra: str = "") -> Path:
    folder = tmp_path / "project"
    (folder / "eval").mkdir(parents=True)
    body = "".join(json.dumps(r) + "\n" for r in rows) + raw_extra
    (folder / "eval" / "queries.jsonl").write_text(body, encoding="utf-8")
    return folder


def with_change(rows: list[dict], index: int, **changes) -> list[dict]:
    copy = [dict(r) for r in rows]
    copy[index].update(changes)
    return copy


def eval_variants() -> dict[str, tuple[list[dict], str]]:
    rows = good_eval_set()
    seeds = rows[:20]
    return {
        "too_few_queries": (rows[:49], ""),
        "duplicate_query_text": (with_change(rows, 30, query="  " + seeds[0]["query"].upper() + " "), ""),
        "unknown_relevant_id": (with_change(rows, 30, relevant_ids=["mem_999"]), ""),
        "missing_seed_query": (rows[:4] + rows[5:], ""),
        "empty_relevant_ids": (with_change(rows, 30, relevant_ids=[]), ""),
        "duplicate_query_id": (with_change(rows, 30, query_id="q01"), ""),
        "lost_seed_label": (with_change(rows, 0, relevant_ids=seeds[0]["relevant_ids"][:1]), ""),
        "repeated_id_in_list": (with_change(rows, 30, relevant_ids=rows[30]["relevant_ids"] * 2), ""),
        "broken_json_line": (rows, "{not json}\n"),
    }


def test_evalset_suite_passes_a_correct_eval_set(tmp_path):
    result = run_suite("test_re_m2_evalset.py", project_dir=write_eval(tmp_path, good_eval_set()))
    assert result.returncode == 0, tail(result)


@pytest.mark.parametrize("flaw", sorted(eval_variants()))
def test_evalset_suite_fails_a_broken_eval_set(tmp_path, flaw):
    rows, raw_extra = eval_variants()[flaw]
    result = run_suite("test_re_m2_evalset.py", project_dir=write_eval(tmp_path, rows, raw_extra))
    assert result.returncode != 0, f"eval set suite should fail with {flaw!r}:\n{tail(result)}"


def test_evalset_suite_fails_when_the_file_is_missing(tmp_path):
    result = run_suite("test_re_m2_evalset.py", project_dir=tmp_path)
    assert result.returncode != 0


def test_each_suite_has_at_least_three_broken_fakes():
    assert min(len(SEARCH_FLAWS), len(DB_FLAWS), len(METRICS_FLAWS), len(eval_variants())) >= 3
