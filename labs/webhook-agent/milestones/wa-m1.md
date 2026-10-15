# wa-m1: design note and repo skeleton (about 45 minutes, week 9)

## Goal

Start your own repo for the service with a design note, a project skeleton and one passing test. You write all of it by hand.

## What to read first

- Lesson `sql-04` (indexes, transactions and PostgreSQL from Python): the queue table you will design here.
- Lesson `wri-01` (READMEs, pull requests and design notes), if you have it.
- `labs/webhook-agent/CONTRACT.md`: all of it. The design note must be consistent with it.

## What to build

1. A new public repo in your own GitHub account (any name you like).
2. `docs/design.md`, one page, with: context, goals, non-goals, the options you considered for the queue (for example a table polled with `FOR UPDATE SKIP LOCKED`, versus Redis, versus a managed queue), the decision, and the risks. Include the `jobs` table you plan: columns, the unique constraint on `event_id`, and the index the worker will use.
3. A Python project: `pyproject.toml` (Python 3.12 or newer), `ruff` configured, `pytest` configured, a `src/` package, and a README that says what the service does, how to run it and how to test it.
4. One real test that passes with `pytest`. It can be about anything small, for example a helper that builds the signature header.
5. A `.gitignore` and a `.env.example` (placeholders only). No secret is ever committed. Run gitleaks as a pre-commit hook.

## Acceptance

This milestone has no automatic test. You are done when all of these are true:

- [ ] `docs/design.md` exists and covers context, goals, non-goals, options, decision and risks.
- [ ] `pytest` passes locally and `ruff check` reports nothing.
- [ ] The repo has a README, `.gitignore` and `.env.example`, and gitleaks runs before each commit.
- [ ] You can explain, out loud, why the unique constraint on `event_id` is the right place to make webhooks idempotent.

## Evidence

On the Labs page, paste a link to the commit that contains your design note and the passing test.
