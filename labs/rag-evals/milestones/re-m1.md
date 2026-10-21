# re-m1: a pgvector table and a search command (about 2 hours, weeks 21 and 22)

## Goal

Load the 300 memories into PostgreSQL with pgvector, and write a search command that returns the memories most likely to answer a question, in two modes: vector and hybrid.

## What to read first

- Lessons `rag-01` (embeddings and vector search) and `rag-02` (retrieval pipelines).
- `CONTRACT.md` sections 4 and 5.

## What to build

1. A PostgreSQL database with the `vector` extension. A local embedding model is recommended (no key, no cost); any model is allowed. Whatever you pick, note its name and vector size in your README.
2. A loader script that reads `data/memories.jsonl` and fills the `memories` table (id, text, embedding). Running it twice must not duplicate rows.
3. `search.py` with `--query`, `--k` and `--mode vector|hybrid`, printing exactly one JSON object as the contract says.
4. Vector mode: embed the query with the same model and order by distance.
5. Hybrid mode: combine the vector ranking with PostgreSQL full-text search (or another keyword method). Say in your README how you combine the two.
6. Read the connection string from `ATHENA_DATABASE_URL`.

## Acceptance

```bash
export ATHENA_DATABASE_URL=<your database>
export ATHENA_PROJECT_DIR=<your project folder>
cd labs/rag-evals
uv run --with pytest --with "psycopg[binary]" pytest acceptance/test_re_m1_database.py acceptance/test_re_m1_search.py -q
```

- [ ] The row count equals the number of memories and every id from the corpus is present.
- [ ] There is one embedding per row, never null, and all have the same dimension.
- [ ] Both modes print one JSON object that matches the contract, with exactly `k` results.
- [ ] Every id is in the corpus, none appears twice, scores never increase down the list.
- [ ] The same query gives the same order twice.
- [ ] An unknown mode exits with a non-zero code.
- [ ] For each mode, at least 16 of the 20 seed queries have a relevant id in the top 10.

## Common mistakes

- Printing a progress bar or a warning to stdout. Stdout must be one JSON object.
- Embedding the query with a different model, or a different prefix, than the documents.
- Sorting by distance but reporting the distance as the score, so scores increase down the list. Report similarity, or sort accordingly.
- A hybrid mode that quietly ignores the keyword part.

## Evidence

A link to the commit where both search test files pass.
