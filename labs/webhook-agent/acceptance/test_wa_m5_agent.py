"""Milestone wa-m5: an agent with tools and guardrails (CONTRACT.md section 9).

Test mode with the fake model script is required. The scripted events use fixed ids, so use a fresh
database for a clean run; repeated runs are still correct because duplicate events return the same job.
"""

from __future__ import annotations

import support


def steps_of(job):
    return job["result"]["steps"]


def test_a_booking_conversation_creates_exactly_the_expected_booking(client, events):
    job = support.submit_and_wait(client, events["evt_m5_book"])
    assert job["status"] == "succeeded", job
    result = job["result"]
    assert result["intent"] == "book"
    assert result["escalated"] is False
    assert len(result["bookings"]) == 1

    mine = [b for b in support.bookings(client) if b["created_by_job"] == job["job_id"]]
    assert len(mine) == 1
    assert mine[0]["booking_id"] == result["bookings"][0]
    assert mine[0]["caller_name"] == "Amara Okafor"
    assert (mine[0]["date"], mine[0]["time"]) == ("2026-11-02", "10:00")


def test_steps_are_listed_in_order_and_there_are_at_most_five(client, events):
    job = support.submit_and_wait(client, events["evt_m5_book"])
    steps = steps_of(job)
    assert [s["n"] for s in steps] == list(range(1, len(steps) + 1))
    assert [(s["action"], s["name"]) for s in steps] == [
        ("tool_call", "lookup_availability"),
        ("tool_call", "create_booking"),
        ("final", None),
    ]
    assert len(steps) <= 5


def test_resending_the_booking_event_does_not_book_twice(client, events):
    first = support.submit_and_wait(client, events["evt_m5_book"])
    support.post_event(client, events["evt_m5_book"])
    support.post_event(client, events["evt_m5_book"])
    mine = [b for b in support.bookings(client) if b["created_by_job"] == first["job_id"]]
    assert len(mine) == 1


def test_escalation_ends_the_run_and_makes_no_booking(client, events):
    job = support.submit_and_wait(client, events["evt_m5_escalate"])
    assert job["status"] == "succeeded", job
    result = job["result"]
    assert result["escalated"] is True
    assert "manager" in result["escalation_reason"].lower()
    assert result["bookings"] == []
    assert [b for b in support.bookings(client) if b["created_by_job"] == job["job_id"]] == []


def test_the_prompt_injection_transcript_creates_no_bookings_and_is_escalated(client, events):
    job = support.submit_and_wait(client, events["evt_m5_injection"])
    assert job["status"] == "succeeded", job
    result = job["result"]
    assert result["escalated"] is True
    assert result["bookings"] == []
    assert [b for b in support.bookings(client) if b["created_by_job"] == job["job_id"]] == []
    assert not any(b["caller_name"] == "Attacker Ltd" for b in support.bookings(client))
    assert len(steps_of(job)) <= 5, "The step limit must stop a model that keeps asking for tools"


def test_a_booking_for_someone_else_is_refused_and_escalated(client, events):
    job = support.submit_and_wait(client, events["evt_m5_wrong_name"])
    result = job["result"]
    assert result["escalated"] is True
    assert result["escalation_reason"] == "blocked_action"
    assert result["bookings"] == []


def test_at_most_one_booking_per_job(client, events):
    job = support.submit_and_wait(client, events["evt_m5_double_book"])
    result = job["result"]
    assert len(result["bookings"]) == 1
    assert result["escalated"] is True
    assert result["escalation_reason"] == "blocked_action"
    mine = [b for b in support.bookings(client) if b["created_by_job"] == job["job_id"]]
    assert [(b["date"], b["time"]) for b in mine] == [("2026-11-03", "09:00")]


def test_an_unknown_tool_is_rejected_but_the_run_continues(client, events):
    job = support.submit_and_wait(client, events["evt_m5_bad_tool"])
    assert job["status"] == "succeeded", job
    result = job["result"]
    assert result["intent"] == "other"
    assert result["bookings"] == []
    assert [s["name"] for s in steps_of(job)][:2] == ["delete_all_bookings", "lookup_availability"]
    assert len(steps_of(job)) <= 5
