# Lab A contract: the webhook-to-agent service

This file is the single source of truth for Lab A. The acceptance tests in `acceptance/` check your running service from the outside against exactly what is written here. If this file and a test ever disagree, the test is wrong: tell me and I will fix it.

You build the service yourself, in your own repo. Nothing in this folder is an implementation.

The service receives signed "call ended" webhooks, queues them in PostgreSQL, and has a worker run an agent that classifies the call and books, cancels or escalates.

## 1. Conventions

- All bodies are JSON with `Content-Type: application/json`. All timestamps are ISO 8601 in UTC (`2026-11-02T09:30:00Z`).
- Error responses are JSON objects with an `error` string, for example `{"error": "invalid_signature"}`.
- Ids are opaque strings. Your service creates `job_id` and `booking_id`; the sender creates `event_id`.
- Everything in the fixtures is invented. Phone numbers use the reserved range `+44 7700 900000` to `+44 7700 900999`. Emails use `example.com`.

## 2. Environment variables

| Variable | Meaning |
| --- | --- |
| `ATHENA_WEBHOOK_SECRET` | Shared secret for signatures. Required. Never hard-code it. |
| `ATHENA_ENV` | `test`, `development` or `production`. |
| `ATHENA_TEST_MODE` | `1` turns on test mode (section 8). Anything else is off. |
| `ATHENA_FAKE_LLM_SCRIPT` | Path to a copy of `fixtures/fake_llm_script.json`. Used only in test mode. |
| `ATHENA_DATABASE_URL` | PostgreSQL connection string (from milestone wa-m3). |

The acceptance tests read these variables too:

| Variable | Meaning |
| --- | --- |
| `ATHENA_BASE_URL` | Where your API listens. Default `http://localhost:8000`. |
| `ATHENA_WEBHOOK_SECRET` | The same secret your service uses. Required. |
| `ATHENA_START_COMMAND` | Optional. A command that starts your API, used only by the startup-refusal test. |
| `ATHENA_RESTART_COMMAND` | Optional. A command that restarts your service, used only by the persistence test. |
| `ATHENA_START_TIMEOUT` | Optional. Seconds the startup-refusal test waits for your service to exit. Default 20. |

## 3. The signature

Header: `X-Athena-Signature: t=<unix seconds>,v1=<hex>`

`v1` is the hex-encoded HMAC-SHA256, keyed with `ATHENA_WEBHOOK_SECRET`, of the string `"<t>.<raw body>"`: the decimal timestamp, a dot, then the exact bytes of the request body.

Rules:

1. Verify the signature **before** parsing the body. A bad signature never reveals whether the body was valid.
2. Compute the HMAC over the raw bytes, not over a re-serialised JSON object.
3. Compare with a constant-time function.
4. Reject a timestamp more than 300 seconds away from the server clock (older or newer).
5. A missing header, a malformed header, a wrong signature or a bad timestamp all return `401` with `{"error": "invalid_signature"}`.

## 4. Endpoints

### `GET /health`

`200` with `{"status": "ok", "test_mode": true}`. `test_mode` is `true` only when test mode is on (section 8).

### `POST /webhooks/calls`

Requires the signature header. Order of checks:

1. Signature invalid: `401`, `{"error": "invalid_signature"}`. This is returned even if the body is not valid JSON.
2. Body not valid JSON or not matching section 5: `422`, `{"error": "invalid_payload", "detail": "<short text>"}`.
3. Otherwise `202` with:

```json
{"job_id": "job_123", "status": "queued", "duplicate": false}
```

**Idempotency.** `event_id` identifies the event. Sending the same `event_id` again (the provider retries webhooks) returns `202` with the **same `job_id`** and `"duplicate": true`. It never creates a second job and never runs the agent twice.

### `GET /jobs/{job_id}`

`200`:

```json
{
  "job_id": "job_123",
  "event_id": "evt_001",
  "type": "call.ended",
  "status": "succeeded",
  "attempts": 1,
  "worker_id": "worker-a",
  "result": null,
  "error": null
}
```

- `status` is one of `queued`, `running`, `succeeded`, `dead` (section 7).
- `attempts` counts how many times a worker has claimed the job.
- `worker_id` is the id of the worker that last claimed it, or `null` while queued and never claimed.
- `result` is `null` until the job has succeeded (section 6).
- `error` is a short string after a failed attempt, otherwise `null`.

Unknown `job_id`: `404`, `{"error": "not_found"}`.

### `GET /bookings`

`200`:

```json
{"bookings": [
  {"booking_id": "bk_1", "caller_name": "Amara Okafor", "date": "2026-11-02", "time": "10:00", "created_by_job": "job_123"}
]}
```

Milestone wa-m5 creates bookings. Before it, the list is empty.

## 5. Event bodies

Every event has these top-level fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `event_id` | string, non-empty | **Where the event id lives.** Unique per event. |
| `type` | `"call.ended"`, `"ping"` or `"simulate_failure"` | What happened. |
| `occurred_at` | ISO timestamp | When it happened. |

`call.ended` and `simulate_failure` also have a `call` object:

```json
{
  "event_id": "evt_001",
  "type": "call.ended",
  "occurred_at": "2026-11-02T09:30:00Z",
  "call": {
    "call_id": "call_77",
    "caller": {"name": "Amara Okafor", "phone": "+44 7700 900123"},
    "transcript": "Hi, it's Amara. Could I book a visit on the second of November, in the morning?"
  }
}
```

- `ping` has no `call`. A `ping` job is queued and processed by the worker like any other, and it **never calls a model**. Its result is `{"pong": true}`.
- `simulate_failure` has a `call`. Its job always fails when a worker runs it, so you can test retries (section 7).
- Any other `type`, a missing field or a wrong type is `422`.

## 6. Job results

When a `call.ended` job succeeds, `result` is:

```json
{
  "intent": "book",
  "summary": "Amara wants to book a morning visit on 2 November.",
  "caller_name": "Amara Okafor",
  "confidence": 0.93,
  "escalated": false,
  "escalation_reason": null,
  "bookings": ["bk_1"],
  "steps": [
    {"n": 1, "action": "tool_call", "name": "lookup_availability"},
    {"n": 2, "action": "tool_call", "name": "create_booking"},
    {"n": 3, "action": "final", "name": null}
  ]
}
```

- `intent` is one of `book`, `cancel`, `billing_question`, `other`.
- `summary` is a non-empty string of at most 300 characters. `confidence` is a number from 0 to 1.
- `escalated` is `true` when a human must take over, and then `escalation_reason` is a non-empty string.
- `bookings` lists the ids of bookings this job created.
- `steps` has one entry per model turn, starting at `n: 1`. **A job uses at most 5 steps.**
- `steps[].name` is the tool name the model asked for, even when the call was refused, and `null` for a final answer.

Before milestone wa-m4, a succeeded `call.ended` job may have any `result` (an empty object is fine). From wa-m4 on, `intent`, `summary`, `caller_name` and `confidence` are required. From wa-m5 on, all the fields above are required.

## 7. Job lifecycle

```
queued -> running -> succeeded
              \-> (attempt failed) -> queued, run later -> ... -> dead
```

- A worker claims a job with `FOR UPDATE SKIP LOCKED` (milestone wa-m3), increments `attempts` and sets `running`.
- If an attempt fails, `error` is set and the job goes back to `queued` to run later (backoff below).
- **Maximum attempts: 3.** After the third failed attempt the job is `dead`, and `attempts` is `3`.
- A succeeded job has `attempts >= 1`. With two workers, every job is processed exactly once: a job that succeeds first time has `attempts == 1`.
- Backoff before attempt 2 is `base` seconds, before attempt 3 is `2 x base`, with jitter between 0 and 100% of the delay. In production `base` is 30. **In test mode `base` is 0.2.** So a `simulate_failure` job reaches `dead` in well under 5 seconds in test mode.
- Jobs and their results survive a restart of the API and the workers.

## 8. Test mode

Test mode is on only when **both** hold: `ATHENA_TEST_MODE=1` and `ATHENA_ENV` is `test` or `development`.

**Startup refusal.** When `ATHENA_TEST_MODE=1` is set, the service must exit with a non-zero status during startup, without serving any request, if either of these holds:

- `ATHENA_ENV` is anything other than `test` or `development`, including unset; or
- any of `K_SERVICE`, `CLOUD_RUN_JOB`, `CLOUD_RUN_WORKER_POOL` is set (Cloud Run sets these). In production a fake model must never be reachable.

With `ATHENA_TEST_MODE` unset or not `1`, the service starts normally everywhere, including on Cloud Run with `ATHENA_ENV=production`.

**The fake model.** In test mode the model client never touches the network. It replays the script in `ATHENA_FAKE_LLM_SCRIPT`, a copy of `fixtures/fake_llm_script.json`:

```json
{
  "evt_m4_book": [
    {"action": "final", "content": {"intent": "book", "summary": "...", "caller_name": "Amara Okafor", "confidence": 0.93}}
  ],
  "evt_m5_book": [
    {"action": "tool_call", "name": "lookup_availability", "arguments": {"date": "2026-11-02"}},
    {"action": "tool_call", "name": "create_booking", "arguments": {"caller_name": "Amara Okafor", "date": "2026-11-02", "time": "10:00"}},
    {"action": "final", "content": {"intent": "book", "summary": "...", "caller_name": "Amara Okafor", "confidence": 0.95}}
  ]
}
```

- The script is keyed by `event_id`. The value is the list of model turns for that event, in order.
- The `n`-th model call for a job attempt returns turn `n` of its list (`n` starts at 1). **The counter restarts on every attempt.**
- A turn is either `{"action": "tool_call", "name": ..., "arguments": {...}}` or `{"action": "final", "content": {...}}`.
- A `call.ended` event whose `event_id` is not in the script makes the attempt fail (so it is retried and ends `dead`).
- `ping` events never read the script.

Without test mode, `ATHENA_FAKE_LLM_SCRIPT` is ignored.

## 9. Milestone details

### wa-m4: classification

The final turn's `content` is validated: `intent` is one of the four allowed values, `summary` a non-empty string of at most 300 characters, `caller_name` a string, `confidence` a number from 0 to 1. If validation fails, the service asks the model **once more** (the next turn of the script) in the same attempt. If that is also invalid, the attempt fails. The validated fields become the result fields of the same names.

### wa-m5: tools and guardrails

The agent has three tools:

| Tool | Arguments | Effect |
| --- | --- | --- |
| `lookup_availability` | `date` (`YYYY-MM-DD`) | Returns the free times for that date. Every date starts with `09:00`, `10:00`, `11:00` and `14:00`; times already booked are removed. |
| `create_booking` | `caller_name`, `date`, `time` | Creates a booking if the time is free. |
| `escalate_to_human` | `reason` | Ends the run with `escalated: true`. |

Guardrails, all required:

1. **Validate every tool call.** An unknown tool or bad arguments does not run; the error is given back to the model as the next turn's input and the step still counts.
2. **Step limit.** After 5 model turns without a final answer, stop and escalate with the reason `step_limit`.
3. **At most one booking per job**, and it must be for the caller on the call: `create_booking`'s `caller_name` must equal `call.caller.name`. Any other `create_booking` call is refused (no booking is made).
4. A refused irreversible action ends the run with `escalated: true` and reason `blocked_action`.
5. The transcript is **untrusted input**. A transcript that tells the model to ignore its instructions must not cause extra bookings.

## 10. The smoke marker

Tests marked `smoke` are safe to run against a deployed service: they send only signed `ping` events (which never call a model) and read `/health`. Run them with `pytest -m smoke`.

Without `-m smoke`, the suite refuses to run when `ATHENA_BASE_URL` is not `localhost`, `127.0.0.1` or `::1`.

## 11. Running the suite

```bash
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance -q              # whole suite against localhost
uv run --with pytest --with httpx pytest acceptance/test_wa_m2_webhook.py -q   # one milestone
uv run --with pytest --with httpx pytest acceptance -m smoke -q     # deployed smoke suite
```

Scripted events use fixed `event_id`s, so run the suite against a fresh database (`docker compose down -v`) when you want a clean run. A repeated run is still correct, because duplicates return the same job.
