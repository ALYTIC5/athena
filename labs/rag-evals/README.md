# Lab B: memory retrieval with evals

You build this project yourself, by hand, in your own repo. This folder holds only the rules, the data and the checks:

| File | What it is |
| --- | --- |
| `CONTRACT.md` | The database, the search command, the eval set format and the metrics command. Read it first and keep it open. |
| `milestones/re-m1.md` to `re-m5.md` | The goal, what to build and the acceptance criteria for each milestone. |
| `data/memories.jsonl` | 300 invented caller memories. |
| `data/queries_seed.jsonl` | 20 labelled example queries. You extend this to at least 50. |
| `acceptance/` | pytest suites that run your commands and read your files. |
| `fixtures/` | Toy run and judgments for the metrics tests. |

There is no implementation here and there never will be. The suites were tested against fakes (see `tests/lab_contract/`), not against a real project, so they check exactly what the contract says.

## Run the checks

```bash
export ATHENA_DATABASE_URL=<your pgvector database>
export ATHENA_PROJECT_DIR=<path to your project>
cd labs/rag-evals
uv run --with pytest --with "psycopg[binary]" pytest acceptance/test_re_m1_database.py acceptance/test_re_m1_search.py -q
uv run --with pytest pytest acceptance/test_re_m2_evalset.py -q
uv run --with pytest pytest acceptance/test_re_m3_metrics.py -q
```

Set `ATHENA_SEARCH_COMMAND` and `ATHENA_METRICS_COMMAND` if you start your commands differently (see the contract).
