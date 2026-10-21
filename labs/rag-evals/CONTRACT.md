# Lab B contract: memory retrieval with evals

This file is the single source of truth for Lab B. The acceptance tests in `acceptance/` check your project from the outside against exactly what is written here. If this file and a test ever disagree, the test is wrong: tell me and I will fix it.

You build everything yourself, in your own repo. Nothing in this folder is an implementation.

You build a retrieval tool over a corpus of invented caller memories ("Priya prefers Tuesday mornings"), a labelled eval set, a metrics command, an experiment and an eval gate in CI.

## 1. Conventions

- All data files are JSON Lines (`.jsonl`): one JSON object per line, UTF-8, no blank lines.
- Everything in `data/` is invented. Names, facts and dates describe nobody real.
- Ids are strings. A memory id looks like `mem_042`, a query id like `q07`. Compare ids as exact strings.

## 2. Files provided

| File | Content |
| --- | --- |
| `data/memories.jsonl` | 300 memories: `id`, `caller_id`, `caller_name`, `created_at` (a date), `text`. |
| `data/queries_seed.jsonl` | 20 labelled queries: `query_id`, `query`, `relevant_ids` (a list of memory ids). |
| `fixtures/toy_run.jsonl`, `toy_qrels.jsonl`, `toy_expected.json` | A tiny run and judgments with the metric values worked out by hand (section 7). |
| `fixtures/uniform_run.jsonl`, `uniform_qrels.jsonl` | A run where every query behaves the same way (section 7). |

## 3. Environment variables

Your code reads:

| Variable | Meaning |
| --- | --- |
| `ATHENA_DATABASE_URL` | PostgreSQL connection string for a database with the pgvector extension. Required. Never hard-code it. |

The acceptance tests read:

| Variable | Default | Meaning |
| --- | --- | --- |
| `ATHENA_PROJECT_DIR` | `.` | The folder of your project. Commands run with this as the working directory. |
| `ATHENA_DATABASE_URL` | none | The database your search command reads. Required for the database check. |
| `ATHENA_SEARCH_COMMAND` | `python search.py` | How to start your search command. |
| `ATHENA_METRICS_COMMAND` | `python metrics.py` | How to start your metrics command. |
| `ATHENA_SEARCH_MODES` | `vector,hybrid` | Which modes the search tests cover. |
| `ATHENA_EVAL_FILE` | `eval/queries.jsonl` | Your eval set, relative to `ATHENA_PROJECT_DIR`. |

The commands are split on spaces like a shell would (so `uv run python search.py` works). Make them work from `ATHENA_PROJECT_DIR`.

## 4. The database (re-m1)

Load the corpus into a table named `memories` with at least these columns:

| Column | Type | Content |
| --- | --- | --- |
| `id` | text, primary key | The memory `id` from `data/memories.jsonl`. |
| `text` | text, not null | The memory `text`. |
| `embedding` | `vector(N)` from pgvector | One embedding per memory, never null. |

`N` is up to you (it depends on your model) but must be the same for every row. The database check asserts: the row count equals the number of lines in `data/memories.jsonl`; the set of ids equals the set in the corpus file; no `text` or `embedding` is null; `vector_dims(embedding)` has exactly one distinct value and it is greater than zero.

## 5. The search command (re-m1)

```
python search.py --query "<text>" --k <int> --mode vector|hybrid
```

- `--mode vector` ranks by embedding similarity. `--mode hybrid` combines vector similarity with keyword or full-text matching (how you combine them is up to you).
- Exit code 0 on success. Print **exactly one JSON object** to stdout and nothing else (send logs to stderr).
- An unknown `--mode`, a missing `--query`, or `--k` below 1 exits with a non-zero code and prints no JSON.

Output:

```json
{
  "query": "who prefers Tuesday morning appointments",
  "mode": "vector",
  "k": 10,
  "results": [
    {"id": "mem_086", "score": 0.83},
    {"id": "mem_284", "score": 0.79}
  ]
}
```

Rules:

- `query`, `mode` and `k` echo the arguments.
- `results` has exactly `min(k, number of memories)` items, best first.
- Each `id` is a memory id that exists in the corpus. No id appears twice.
- `score` is a number and never increases down the list (higher is better, whatever scale you use).
- The same arguments give the same ids in the same order every time.
- A `text` field per result is allowed but not required.

**Seed threshold.** For each mode, a relevant id must appear in the top 10 for at least 80% of the queries in `data/queries_seed.jsonl` (at least 16 of 20). A plain keyword ranking (BM25) reaches 18 of 20 on this data, so 80% is reachable without any model.

## 6. The eval set (re-m2)

`eval/queries.jsonl` in your project has the same shape as `data/queries_seed.jsonl`:

```json
{"query_id": "q21", "query": "caller who is vegetarian", "relevant_ids": ["mem_105"]}
```

Rules, all checked by the suite:

- At least 50 queries, and it includes all 20 seed queries unchanged (same `query_id`, same `query`). For a seed query, your `relevant_ids` must contain every seed id (you may add more).
- Every line parses and has the keys `query_id` (string), `query` (non-empty string) and `relevant_ids` (a non-empty list of unique strings). Extra keys are allowed.
- `query_id` values are unique.
- No two queries are the same after lower-casing, trimming and collapsing whitespace.
- Every relevant id exists in `data/memories.jsonl`.

You label the new queries yourself. Read the memories first, then write the question a person would ask, then list every memory that answers it.

## 7. The metrics command (re-m3)

```
python metrics.py --run run.jsonl --qrels qrels.jsonl --seed 0
```

Files:

- `qrels.jsonl` lines: `{"query_id": "q1", "relevant_ids": ["a", "b"]}` (the eval set file works as a qrels file).
- `run.jsonl` lines: `{"query_id": "q1", "ranked_ids": ["x", "a", "y"]}`, best first, any length.

Definitions. The score is computed for each query that is in `qrels`, then averaged.

- `recall@k` = (number of relevant ids in the first k of `ranked_ids`) / (number of relevant ids).
- `mrr` = 1 / rank of the first relevant id in `ranked_ids` (rank 1 is the first item), or 0 when none appears.
- A run line whose `query_id` is not in qrels is ignored. A `query_id` in qrels with no run line is an error: exit with code 2, print a message to stderr and print no JSON.

Output (one JSON object on stdout, exit code 0):

```json
{
  "n_queries": 6,
  "seed": 0,
  "metrics": {
    "recall@5": {"value": 0.416667, "ci95": [0.166667, 0.75]},
    "recall@10": {"value": 0.666667, "ci95": [0.333333, 1.0]},
    "mrr": {"value": 0.455628, "ci95": [0.166667, 0.833333]}
  }
}
```

- `value` is the mean over queries. `ci95` is `[low, high]`, the 2.5th and 97.5th percentiles of the metric over at least 1000 bootstrap resamples of the **queries** (sample queries with replacement, same number as the original, recompute the mean). Use the `--seed` for your random generator.
- The same inputs and seed give byte-identical output. Round numbers to 6 decimals.
- `low <= value <= high`, and all numbers are between 0 and 1.
- When every query has the same score, `low == high == value`.

Toy files: `fixtures/toy_expected.json` holds the exact point values for the toy run (the intervals depend on your random generator, so the toy test checks only that they are sensible). `uniform_run.jsonl` and `uniform_qrels.jsonl` make every query score the same, so each interval must collapse to a single number.

## 8. The experiment and the eval gate (re-m4, re-m5)

These are checked by reading, not by a script.

- **re-m4:** `reports/experiment-1.md` in your project compares the baseline with one change (one change only), shows both sets of numbers with their intervals, says whether the intervals overlap, and ends with an honest conclusion, including "no clear difference" when that is true.
- **re-m5:** a CI job runs your search over the whole eval set, runs `metrics.py`, and fails when recall@10 drops more than a margin you chose below a stored baseline number. Show one green run and one red run (a commit that makes retrieval worse on purpose).

## 9. Common mistakes

- Printing logs or a progress bar to stdout. Stdout must be one JSON object.
- Returning ids as numbers or in a different format than the corpus.
- Using Python's global `random` without setting the seed, so two runs differ.
- Computing recall with `k` in the denominator instead of the number of relevant ids.
- Labelling only the first memory that matches a query. If three memories answer it, list all three.
