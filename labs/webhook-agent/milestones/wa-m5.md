# wa-m5: an agent with tools and guardrails (about 2.75 hours, week 17)

## Goal

Turn the classifier into an agent that can look up availability, make one booking and escalate, with guardrails that hold even when the transcript tries to manipulate the model.

## What to read first

- Lessons `ai-02` (tool calling and the agent loop) and `ai-03` (guardrails, prompt injection and cost).
- `CONTRACT.md` section 9 (wa-m5).

## What to build

1. An agent loop that you write by hand: call the model, run the tool it asks for, give the result back, repeat until it returns a final answer or hits the step limit.
2. Three tools: `lookup_availability(date)`, `create_booking(caller_name, date, time)` and `escalate_to_human(reason)`. Bookings and availability live in PostgreSQL; every date starts with 09:00, 10:00, 11:00 and 14:00.
3. A `GET /bookings` endpoint.
4. Guardrails, all of them:
   - validate every tool call (unknown tool or bad arguments does not run; tell the model and count the step);
   - stop after 5 model turns and escalate with the reason `step_limit`;
   - at most one booking per job;
   - `create_booking` must be for the caller on the call (`call.caller.name`), otherwise refuse, escalate with `blocked_action` and stop;
   - treat the transcript as data, never as instructions.
5. The result shape in the contract: `escalated`, `escalation_reason`, `bookings` and `steps`.

## Acceptance

```bash
cd labs/webhook-agent
uv run --with pytest --with httpx pytest acceptance/test_wa_m5_agent.py -q
```

- [ ] The booking conversation creates exactly one booking, listed by `GET /bookings`.
- [ ] `result.steps` lists the steps in order and never exceeds 5.
- [ ] Resending a booking event does not book twice.
- [ ] The escalation scenario ends escalated with no booking.
- [ ] The prompt-injection transcript creates no bookings and is escalated.
- [ ] A booking for someone else, and a second booking in one job, are refused with `blocked_action`.
- [ ] An unknown tool is rejected and the run continues.

## Common mistakes

- Trusting the model's arguments because the model "knows" the caller. The check belongs in your code.
- Putting the guardrail in the prompt only. A prompt is a request, not a control.
- Counting tool executions instead of model turns for the step limit.

## Evidence

A link to the commit where `test_wa_m5_agent.py` passes.
