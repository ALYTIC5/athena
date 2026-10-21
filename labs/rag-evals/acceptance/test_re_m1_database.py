"""re-m1: the pgvector table (CONTRACT.md section 4)."""

from __future__ import annotations

import pytest

import support


@pytest.fixture(scope="module")
def cursor():
    connection = support.db_connect()
    try:
        yield connection.cursor()
    finally:
        connection.close()


def one(cursor, sql: str):
    cursor.execute(sql)
    return cursor.fetchone()[0]


def test_row_count_matches_the_corpus(cursor):
    rows = one(cursor, "SELECT count(*) FROM memories")
    assert rows == len(support.corpus()), f"memories has {rows} rows; the corpus has {len(support.corpus())}"


def test_ids_match_the_corpus(cursor):
    cursor.execute("SELECT id FROM memories")
    found = {row[0] for row in cursor.fetchall()}
    missing = sorted(support.corpus_ids() - found)[:5]
    extra = sorted(found - support.corpus_ids())[:5]
    assert not missing and not extra, f"ids differ from the corpus. Missing (first 5): {missing}. Extra: {extra}"


def test_no_text_or_embedding_is_null(cursor):
    nulls = one(cursor, "SELECT count(*) FROM memories WHERE text IS NULL OR embedding IS NULL")
    assert nulls == 0, f"{nulls} rows have a null text or embedding"


def test_every_embedding_has_the_same_dimension(cursor):
    cursor.execute("SELECT DISTINCT vector_dims(embedding) FROM memories")
    dims = [row[0] for row in cursor.fetchall()]
    assert len(dims) == 1, f"embeddings have different dimensions: {sorted(dims)}"
    assert dims[0] > 0, "the embedding dimension must be greater than zero"
