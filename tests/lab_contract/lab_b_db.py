"""A small fixture database for the Lab B database check, built in memory with sqlite3.

The suite only needs `memories(id, text, embedding)` and a `vector_dims` function, so sqlite stands in
for PostgreSQL with pgvector. LAB_B_FLAWS makes it wrong: missing_row, mixed_dims, null_embedding, wrong_ids.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "labs" / "rag-evals" / "data" / "memories.jsonl"


def make_connection() -> sqlite3.Connection:
    flaws = {f for f in os.environ.get("LAB_B_FLAWS", "").split(",") if f}
    rows = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines()]
    connection = sqlite3.connect(":memory:")
    connection.create_function("vector_dims", 1, lambda value: None if value is None else len(json.loads(value)))
    connection.execute("CREATE TABLE memories (id TEXT PRIMARY KEY, text TEXT, embedding TEXT)")
    for index, row in enumerate(rows):
        dim = 4 if not ("mixed_dims" in flaws and index == 7) else 5
        embedding: str | None = json.dumps([0.1] * dim)
        if "null_embedding" in flaws and index == 3:
            embedding = None
        row_id = row["id"] if not ("wrong_ids" in flaws and index == 2) else "mem_X"
        if "missing_row" in flaws and index == 0:
            continue
        connection.execute("INSERT INTO memories VALUES (?, ?, ?)", (row_id, row["text"], embedding))
    connection.commit()
    return connection
