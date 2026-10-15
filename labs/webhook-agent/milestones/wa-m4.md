# wa-m4: a model client and classification (about 2.25 hours, weeks 15 and 16)

## Goal

The worker runs a model on each `call.ended` transcript and stores a validated classification as the job result. In test mode a scripted fake model replaces the real one, so the tests are free and repeatable.

## What to read first

- Lesson `ai-01` (LLM APIs and structured output).
- `CONTRACT.md` sections 6, 8 and 9 (wa-m4).

## What to build

1. A small `ModelClient` interface (a Protocol) with one method that takes the conversation so far and returns the next turn.
2. `FakeModelClient`: replays the script in `ATHENA_FAKE_LLM_SCRIPT` by `event_id`; the counter restarts on every attempt. Use it only when test mode is on.
3. A real client behind the same interface, with the API key read from the environment and a monthly spending limit set at the provider. You do not need to test the real client with the acceptance suite.
4. Validation with Pydantic: `intent` in `book`, `cancel`, `billing_question`, `other`; `summary` 1 to 300 characters; `caller_name` a string; `confidence` from 0 to 1.
5. On invalid output, ask once more inside the same attempt. If it is still invalid, the attempt fails.
6. Test mode switches on only when `ATHENA_TEST_MODE=1` and `ATHENA_ENV` is `test` or `development`.

## Acceptance

```bash
cd labs/webhook-agent
cp fixtures/fake_llm_script.json /tmp/fake_llm_script.json     # your service reads this path
uv run --with pytest --with httpx pytest acceptance/test_wa_m4_classify.py -q
```

- [ ] The four scripted transcripts produce the expected intent and caller name.
- [ ] Every result field is validated and in range.
- [ ] Invalid output is retried once within the attempt (`attempts == 1` in the success case).
- [ ] Output that stays invalid ends `dead` after three attempts.
- [ ] An unscripted `call.ended` event fails in test mode; `ping` never reads the script.

## Evidence

A link to the commit where `test_wa_m4_classify.py` passes.
