"""Helpers shared by the Lab B acceptance tests.

These tests run your commands and read your files. Nothing here imports your code.
"""

from __future__ import annotations

import importlib
import json
import os
import shlex
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

LAB = Path(__file__).resolve().parent.parent
DATA = LAB / "data"
FIXTURES = LAB / "fixtures"
COMMAND_TIMEOUT = 180.0


def project_dir() -> Path:
    return Path(os.environ.get("ATHENA_PROJECT_DIR", ".")).resolve()


def search_command() -> list[str]:
    return shlex.split(os.environ.get("ATHENA_SEARCH_COMMAND", "python search.py"))


def metrics_command() -> list[str]:
    return shlex.split(os.environ.get("ATHENA_METRICS_COMMAND", "python metrics.py"))


def search_modes() -> list[str]:
    raw = os.environ.get("ATHENA_SEARCH_MODES", "vector,hybrid")
    return [m.strip() for m in raw.split(",") if m.strip()]


def eval_file() -> Path:
    return project_dir() / os.environ.get("ATHENA_EVAL_FILE", "eval/queries.jsonl")


def run_command(command: list[str], args: list[str]) -> subprocess.CompletedProcess[str]:
    """Run one of your commands from your project folder, the way the contract says."""
    return subprocess.run(
        [*command, *args],
        cwd=str(project_dir()),
        capture_output=True,
        text=True,
        timeout=COMMAND_TIMEOUT,
        env=os.environ.copy(),
    )


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    """Read a JSON Lines file strictly: every line must be a JSON object, no blank lines."""
    if not path.is_file():
        raise AssertionError(f"{path} does not exist")
    rows: list[dict[str, Any]] = []
    lines = path.read_text(encoding="utf-8").split("\n")
    if lines and lines[-1] == "":
        lines.pop()  # the newline that ends the last line
    for number, line in enumerate(lines, start=1):
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise AssertionError(f"{path.name} line {number} is not valid JSON: {error}") from error
        if not isinstance(row, dict):
            raise AssertionError(f"{path.name} line {number} is not a JSON object")
        rows.append(row)
    return rows


@lru_cache(maxsize=1)
def corpus() -> list[dict[str, Any]]:
    return load_jsonl(DATA / "memories.jsonl")


def corpus_ids() -> set[str]:
    return {row["id"] for row in corpus()}


@lru_cache(maxsize=1)
def seed_queries() -> list[dict[str, Any]]:
    return load_jsonl(DATA / "queries_seed.jsonl")


def normalise_query(text: str) -> str:
    return " ".join(text.lower().split())


def db_connect() -> Any:
    """A connection to your database. ATHENA_DB_FACTORY=module:factory is for the maintainers'
    contract tests, which use a small fixture database. You can ignore it."""
    spec = os.environ.get("ATHENA_DB_FACTORY")
    if spec:
        module_name, attr = spec.split(":", 1)
        factory: Callable[[], Any] = getattr(importlib.import_module(module_name), attr)
        return factory()
    url = os.environ.get("ATHENA_DATABASE_URL")
    if not url:
        raise RuntimeError("Set ATHENA_DATABASE_URL to the database your search command reads.")
    import psycopg  # noqa: PLC0415 (only the database check needs it)

    return psycopg.connect(url)
