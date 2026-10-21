# re-m3: a metrics command with confidence intervals (about 2 hours, weeks 24 and 25)

## Goal

Turn a run (what your search returned) and judgments (what is right) into recall@5, recall@10 and MRR, each with a bootstrap 95% interval, the same every time you run it with the same seed.

## What to read first

- Lesson `eval-02` (experiments and honest reporting).
- `CONTRACT.md` section 7.

## What to build

1. A command `metrics.py --run run.jsonl --qrels qrels.jsonl --seed 0`.
2. Recall at k and reciprocal rank exactly as the contract defines them, averaged over the queries in qrels.
3. A bootstrap: resample the queries with replacement at least 1000 times, recompute each mean, take the 2.5th and 97.5th percentiles. Use a random generator created from `--seed`, never the global one.
4. A clear error (exit code 2, message on stderr, no JSON) when a qrels query has no run line.
5. A small script that runs your search for every query in an eval file and writes `run.jsonl` in the format the metrics command reads. You will use it in re-m4 and re-m5.

## Acceptance

```bash
cd labs/rag-evals
uv run --with pytest pytest acceptance/test_re_m3_metrics.py -q
```

- [ ] On the toy files the three values match the hand-worked numbers.
- [ ] Each interval satisfies `low <= value <= high` and stays between 0 and 1.
- [ ] Running twice with the same seed prints identical output.
- [ ] When every query scores the same (the uniform fixture), each interval is a single number.
- [ ] A qrels query missing from the run exits with code 2 and prints no JSON.
- [ ] A run line for an unknown query is ignored.

## Common mistakes

- Dividing recall by `k` instead of by the number of relevant ids.
- Resampling the individual results instead of the queries. The query is the unit of evidence.
- Using `random.seed` globally, so another library call changes the result.
- Counting a query as zero when it is missing from the run. A missing query is a bug, not a miss.

## Evidence

A link to the commit where `test_re_m3_metrics.py` passes.
