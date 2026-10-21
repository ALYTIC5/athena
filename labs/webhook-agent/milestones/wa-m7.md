# wa-m7: deployed on Cloud Run with managed PostgreSQL (about 2.75 hours, week 20)

## Goal

Your service runs on the internet, and a smoke suite proves it without ever calling a model.

## What to read first

- Lesson `ops-02` (deploying to the cloud).
- `CONTRACT.md` sections 8 and 10.

## What to build

1. **Set a billing budget alert before anything else.**
2. Deploy the API to Cloud Run. Deploy the worker as a Cloud Run worker pool (continuous, no HTTP endpoint) or as a Cloud Run job on a schedule.
3. A managed PostgreSQL: a free tier at Supabase or Neon, or Cloud SQL. Check the current pricing page and write the date next to any cost you note.
4. Secrets (the webhook secret, the database URL, the model key) in Secret Manager, mounted as environment variables. Test mode is **off**.
5. Your service must start on Cloud Run: it is production, so `ATHENA_ENV=production` and `ATHENA_TEST_MODE` unset. If someone sets `ATHENA_TEST_MODE=1` there, it must refuse to start.
6. Know how to read logs and roll back to the previous revision.

## Acceptance

```bash
export ATHENA_BASE_URL=https://<your-service>.run.app
export ATHENA_WEBHOOK_SECRET=<the production secret>
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance -m smoke -q
```

- [ ] `GET /health` returns `status: "ok"` and `test_mode: false`.
- [ ] A request with a bad signature returns 401.
- [ ] A signed `ping` is accepted (202).
- [ ] Repeating the same `ping` returns the same `job_id`.
- [ ] The startup-refusal test passes locally (`ATHENA_START_COMMAND`).

The smoke tests send only `ping` events, so they never call a model and cost nothing.

## Common mistakes

- Leaving test mode on in production, which would let anyone with the signing key script the model.
- Putting the secret in a plain environment variable in the console instead of Secret Manager.
- Forgetting that the worker needs the database URL too.

## Evidence

The deployed URL and a link to the commit or CI run that deployed it.
