# re-m5: an eval gate in CI (about 1.5 hours, week 26)

## Goal

CI fails when a change makes retrieval clearly worse, so a regression cannot be merged by accident.

## What to read first

- Lesson `eval-03` (evals in CI).
- `CONTRACT.md` section 8.

## What to build

1. Store a baseline number: the recall@10 of your current best setting on your eval set, in a file in the repo (for example `eval/baseline.json`), with the date and the settings.
2. A script that runs your search over the whole eval set, runs `metrics.py`, and compares recall@10 with the baseline. It exits non-zero when recall@10 is more than your margin below the baseline. Choose the margin from your own intervals (it should be wider than normal run-to-run noise, which for a deterministic search is zero) and write the reason in the README.
3. A GitHub Actions job that starts PostgreSQL with pgvector, loads the corpus, runs the script and fails the build on a drop. Keep keys out of the repo; with a local embedding model you need none.
4. Prove it works: make one commit that makes retrieval worse on purpose (for example, break the hybrid weighting), watch CI go red, then revert and watch it go green.

## Checklist

- [ ] The baseline and its settings are stored in the repo.
- [ ] The gate compares recall@10 and exits non-zero on a drop larger than the margin.
- [ ] The margin has a written reason.
- [ ] One red run and one green run exist, and both are linked.
- [ ] No secret is in the repo or in the logs.

## Common mistakes

- A margin so large that nothing can fail, or so small that a harmless change does.
- Updating the baseline in the same commit that makes things worse.
- A gate that only runs the unit tests and never touches the eval set.

## Evidence

Links to the red run and the green run.
