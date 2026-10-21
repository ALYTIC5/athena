# wa-m2: a signed webhook endpoint (about 2.75 hours, week 12)

## Goal

A FastAPI service with `GET /health` and a signed `POST /webhooks/calls`. Jobs can live in memory for now; the database arrives in wa-m3.

## What to read first

- Lessons `api-01` (HTTP and REST), `api-02` (building APIs with FastAPI) and `api-03` (webhooks done right).
- `CONTRACT.md` sections 1 to 5.

## What to build

1. `GET /health` returning `{"status": "ok", "test_mode": <bool>}`.
2. `POST /webhooks/calls` that, in this order:
   1. reads the **raw body bytes**;
   2. verifies the `X-Athena-Signature` header (`t=<unix>,v1=<hex>`) with `hmac.compare_digest`, rejecting timestamps more than 300 seconds old or in the future;
   3. only then parses the body and validates it with Pydantic;
   4. creates a job, or returns the existing one for a repeated `event_id`.
3. `GET /jobs/{job_id}` returning the job shape from the contract (a job can be `succeeded` immediately for `ping`).
4. The secret comes from `ATHENA_WEBHOOK_SECRET`. It is never in the code.
5. Your own tests for the signature function (pytest, with a fixed clock) before you run the acceptance suite.

## Acceptance

```bash
export ATHENA_WEBHOOK_SECRET=<the secret your service uses>
export ATHENA_TEST_MODE=1 ATHENA_ENV=test   # for the service
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance/test_wa_m2_webhook.py -q
```

- [ ] Health returns 200 with `status: "ok"` and `test_mode: true`.
- [ ] A bad, missing, malformed, old or future signature returns 401, even when the body is invalid.
- [ ] A valid signature with an invalid body returns 422.
- [ ] A valid event returns 202 with a `job_id`.
- [ ] The same `event_id` again returns the same `job_id`.
- [ ] The signature is checked over the raw bytes (the suite sends oddly spaced JSON to prove it).

## Common mistakes

- Verifying a re-serialised body (`json.dumps(parsed)`): spacing and key order change, so a correct signature fails.
- Parsing the body first, so a bad signature with a bad body returns 422 and leaks information.
- Comparing signatures with `==` instead of `hmac.compare_digest`.

## Evidence

A link to the commit where `test_wa_m2_webhook.py` passes.
