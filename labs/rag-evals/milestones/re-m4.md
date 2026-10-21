# re-m4: one experiment and an honest report (about 2 hours, weeks 25 and 26)

## Goal

Change one thing about your retrieval, measure it against the baseline on your eval set, and write down what you can and cannot conclude.

## What to read first

- Lessons `eval-02` (experiments and honest reporting) and `ops-03` (observability for LLM apps).
- `CONTRACT.md` section 8.

## What to build

1. Run your baseline (say which mode and settings) over the eval set and save the run and the metrics output.
2. Pick **one** change: another embedding model, hybrid versus vector, a different weighting, chunking the memories differently. Change nothing else.
3. Run it, save the run and the metrics output.
4. Write `reports/experiment-1.md` with: the question, the baseline, the change, both sets of numbers with their intervals in a table, whether the intervals overlap, two or three queries that got better or worse and why, and a conclusion.
5. If the intervals overlap, the honest conclusion is that you cannot tell the two apart on this eval set. Say so, and say what you would need to tell them apart (more queries, more careful labels).

## Checklist (read by you and by the reviewer)

- [ ] Exactly one thing changed, and the report says what.
- [ ] Both runs use the same eval set and the same seed for the metrics.
- [ ] The report shows the numbers with intervals, not only the point values.
- [ ] It looks at specific queries, not just averages.
- [ ] The conclusion matches the numbers. It does not claim an improvement the intervals do not support.

## Common mistakes

- Changing the model and the weighting in the same run, then not knowing which one mattered.
- Reporting a gain of 0.02 with intervals of plus or minus 0.1 as if it were real.
- Tuning on the eval set until it looks good, then reporting it as if it were new evidence.

## Evidence

A link to `reports/experiment-1.md` in your repo.
