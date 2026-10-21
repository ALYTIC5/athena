"""re-m2: the eval set (CONTRACT.md section 6)."""

from __future__ import annotations

import pytest

import support


@pytest.fixture(scope="module")
def rows():
    return support.load_jsonl(support.eval_file())


def test_at_least_fifty_queries(rows):
    assert len(rows) >= 50, f"{len(rows)} queries; at least 50 are needed"


def test_every_line_has_the_right_shape(rows):
    for number, row in enumerate(rows, start=1):
        where = f"line {number}"
        assert isinstance(row.get("query_id"), str) and row["query_id"], f"{where}: `query_id` must be a non-empty string"
        assert isinstance(row.get("query"), str) and row["query"].strip(), f"{where}: `query` must be a non-empty string"
        ids = row.get("relevant_ids")
        assert isinstance(ids, list) and ids, f"{where}: `relevant_ids` must be a non-empty list"
        assert all(isinstance(i, str) for i in ids), f"{where}: every relevant id must be a string"
        assert len(set(ids)) == len(ids), f"{where}: `relevant_ids` has a repeated id"


def test_query_ids_are_unique(rows):
    seen: set[str] = set()
    for row in rows:
        assert row["query_id"] not in seen, f"query_id {row['query_id']!r} appears more than once"
        seen.add(row["query_id"])


def test_no_duplicate_queries(rows):
    seen: dict[str, str] = {}
    for row in rows:
        key = support.normalise_query(row["query"])
        assert key not in seen, f"{row['query_id']} repeats the query of {seen[key]}: {row['query']!r}"
        seen[key] = row["query_id"]


def test_every_relevant_id_exists_in_the_corpus(rows):
    for row in rows:
        unknown = [i for i in row["relevant_ids"] if i not in support.corpus_ids()]
        assert not unknown, f"{row['query_id']} lists ids that are not in the corpus: {unknown}"


def test_all_seed_queries_are_included_with_their_labels(rows):
    by_id = {row["query_id"]: row for row in rows}
    for seed in support.seed_queries():
        mine = by_id.get(seed["query_id"])
        assert mine is not None, f"seed query {seed['query_id']} is missing"
        assert mine["query"] == seed["query"], f"seed query {seed['query_id']} was changed"
        lost = sorted(set(seed["relevant_ids"]) - set(mine["relevant_ids"]))
        assert not lost, f"{seed['query_id']} no longer lists the seed's relevant ids {lost}"
