# wa-m6: Docker, Compose and CI (about 2.5 hours, weeks 18 and 19)

## Goal

Anyone can run your service with one command, and every push is tested by CI.

## What to read first

- Lesson `ops-01` (Docker and CI).
- `CONTRACT.md` section 2 (environment variables).

## What to build

1. A `Dockerfile` for the API and worker image: a slim Python base, dependencies installed before the code is copied (so layers cache), a non-root user, and no secret baked in.
2. `docker-compose.yml` with PostgreSQL, the API and **two** workers, configured with environment variables. Put placeholders in `.env.example`; the real `.env` stays out of git.
3. A GitHub Actions workflow that runs on every push and pull request: install, `ruff check`, a type check, and your own tests. Secrets come from repository secrets and never appear in logs.
4. A second job that starts the Compose stack and runs the whole acceptance suite against it.

## Acceptance

```bash
docker compose up --build -d
export ATHENA_WEBHOOK_SECRET=<the secret in your .env>
cd labs/webhook-agent && uv run --with pytest --with httpx pytest acceptance -q
```

- [ ] `docker compose up` brings up the database, the API and two workers.
- [ ] The whole acceptance suite passes against localhost, including the concurrency test with two workers.
- [ ] CI is green on your main branch.
- [ ] No secret is in the image, the repo or the CI logs.

## Evidence

A link to a green CI run on your repo.
