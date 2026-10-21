# Lab A: the webhook-to-agent service

You build this service yourself, by hand, in your own repo. This folder holds only the rules and the checks:

| File | What it is |
| --- | --- |
| `CONTRACT.md` | Every request, response, status code, field and rule. Read it first and keep it open. |
| `milestones/wa-m1.md` to `wa-m7.md` | The goal, what to build and the acceptance criteria for each milestone. |
| `acceptance/` | Black-box pytest suites that call your running service over HTTP. |
| `fixtures/` | Invented events (`events.json`) and the fake model script (`fake_llm_script.json`). |
| `tools/send_event.py` | Send one signed event to your service by hand. |

There is no implementation here and there never will be. The suites were tested against fakes (see `tests/lab_contract/`), not against a real service, so they check exactly what the contract says.

## Run the checks

```bash
export ATHENA_WEBHOOK_SECRET=<the secret your service uses>
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance -q           # everything, against localhost
uv run --with pytest --with httpx pytest acceptance -m smoke -q  # the deployed smoke tests
```

`ATHENA_BASE_URL` defaults to `http://localhost:8000`. The full suite refuses to run against any other host; only `-m smoke` may.

## Send an event by hand

```bash
python tools/send_event.py ping
python tools/send_event.py evt_m4_book
```
