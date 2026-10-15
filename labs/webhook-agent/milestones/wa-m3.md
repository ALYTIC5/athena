# wa-m3: a PostgreSQL job store and worker (about 3.5 hours, weeks 13 and 14)

## Goal

Persist jobs in PostgreSQL and run them with a worker that claims work safely, retries with backoff, and gives up after three attempts. With two workers, every job is processed exactly once.

## What to read first

- Lesson `sql-04` (transactions, row locks and queue tables).
- `CONTRACT.md` sections 4 and 7.

## What to build

1. A `jobs` table with, at least: an id, `event_id` (unique), `type`, the payload, `status`, `attempts`, `run_after`, `result`, `error` and `worker_id`. Add a migration (up and down SQL, or Alembic).
2. The webhook endpoint now inserts into the table. A duplicate `event_id` returns the existing job, even when two requests arrive at once (use the unique constraint, not a read-then-write check).
3. A worker process. It claims a job with a single statement of the form `UPDATE ... WHERE id = (SELECT id ... WHERE status = 'queued' AND run_after <= now() ORDER BY ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...`, which also increments `attempts` and records its own `worker_id`.
4. `ping` jobs succeed with `{"pong": true}` and never touch a model. `simulate_failure` jobs always fail.
5. A failed attempt sets `error`, puts the job back to `queued` and sets `run_after` using the backoff in the contract (test mode: 0.2 s then 0.4 s, with jitter). The third failure makes the job `dead`.
6. State survives restarts of the API and the workers.

## Acceptance

```bash
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance/test_wa_m3_queue.py -q
```

Start **two** workers to run the concurrency test (otherwise it skips with a message). To run the persistence test, set `ATHENA_RESTART_COMMAND` to a command that restarts your service.

- [ ] Jobs persist across restarts.
- [ ] `GET /jobs/{id}` shows status, attempts and worker id.
- [ ] 30 jobs sent at once are each processed exactly once (`attempts == 1`) by two workers.
- [ ] A `simulate_failure` job ends `dead` with `attempts == 3` in a few seconds, never earlier.

## Common mistakes

- Claiming with `SELECT` and then `UPDATE` in two steps: two workers read the same row.
- Counting attempts when a job finishes instead of when it is claimed.
- Using `time.sleep` in the worker for backoff instead of `run_after`, which holds a row hostage.

## Evidence

A link to the commit where `test_wa_m3_queue.py` passes with two workers.
