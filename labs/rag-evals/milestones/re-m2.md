# re-m2: a labelled eval set (about 1 hour, week 23)

## Goal

Grow the 20 seed queries into at least 50 labelled queries that you wrote yourself. The set is what you will trust, so it has to be correct.

## What to read first

- Lesson `eval-01` (eval sets and retrieval metrics).
- `CONTRACT.md` section 6.

## What to build

1. `eval/queries.jsonl` in your project. Start by copying `data/queries_seed.jsonl`.
2. Add at least 30 new queries. Read the memories first, then write the question a person would ask, then list **every** memory that answers it. Write some queries in different words from the memory, because that is where retrieval gets hard.
3. Do not label by running your search and accepting what comes back. That makes the eval measure your search against itself.

## Acceptance

```bash
export ATHENA_PROJECT_DIR=<your project folder>
cd labs/rag-evals
uv run --with pytest pytest acceptance/test_re_m2_evalset.py -q
```

- [ ] At least 50 queries, including all 20 seed queries unchanged.
- [ ] Every line has `query_id`, `query` and a non-empty list of unique `relevant_ids`.
- [ ] No duplicate `query_id` and no duplicate query text (ignoring case and spacing).
- [ ] Every relevant id exists in the corpus.
- [ ] Each seed query still lists the seed's relevant ids.

## Common mistakes

- Labelling only the first matching memory when two or three answer the question. Recall then looks worse than it is.
- Adding a near-copy of a query with one word changed. It passes the duplicate check but counts the same result twice.
- Writing every query with the exact words in the memory, so a keyword search looks perfect.

## Evidence

A link to the commit that adds `eval/queries.jsonl`.
