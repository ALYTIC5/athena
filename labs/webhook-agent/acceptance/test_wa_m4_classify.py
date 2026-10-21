"""Milestone wa-m4: a model client and classification (CONTRACT.md sections 6, 8 and 9).

These tests need the service to run in test mode with ATHENA_FAKE_LLM_SCRIPT pointing at a copy of
fixtures/fake_llm_script.json. No real model is called.
"""

from __future__ import annotations

import pytest

import support

INTENTS = {"book", "cancel", "billing_question", "other"}

CASES = [
    ("evt_m4_book", "book", "Amara Okafor"),
    ("evt_m4_cancel", "cancel", "Jonas Weber"),
    ("evt_m4_billing", "billing_question", "Mei Tanaka"),
    ("evt_m4_other", "other", "Sofia Reyes"),
]


@pytest.mark.parametrize(("event_id", "intent", "caller_name"), CASES)
def test_scripted_transcripts_produce_the_expected_intent(client, events, event_id, intent, caller_name):
    job = support.submit_and_wait(client, events[event_id])
    assert job["status"] == "succeeded", job
    result = job["result"]
    assert result["intent"] == intent
    assert result["caller_name"] == caller_name


@pytest.mark.parametrize(("event_id", "intent", "caller_name"), CASES)
def test_result_fields_are_validated_and_in_range(client, events, event_id, intent, caller_name):
    result = support.submit_and_wait(client, events[event_id])["result"]
    assert result["intent"] in INTENTS
    assert isinstance(result["summary"], str) and 0 < len(result["summary"]) <= 300
    assert isinstance(result["caller_name"], str)
    assert isinstance(result["confidence"], (int, float)) and 0 <= result["confidence"] <= 1


def test_invalid_model_output_is_retried_once_within_the_attempt(client, events):
    job = support.submit_and_wait(client, events["evt_m4_invalid_then_valid"])
    assert job["status"] == "succeeded", job
    assert job["attempts"] == 1, "The second model turn is a retry inside the same attempt, not a new attempt"
    assert job["result"]["intent"] == "billing_question"
    assert job["result"]["caller_name"] == "Kofi Mensah"


def test_output_that_stays_invalid_fails_the_job(client, events):
    job = support.submit_and_wait(client, events["evt_m4_always_invalid"])
    assert job["status"] == "dead", job
    assert job["attempts"] == 3
    assert job["result"] is None
    assert job["error"]


def test_an_event_missing_from_the_script_fails_in_test_mode(client):
    event = support.call_event(event_id=support.unique_id("evt_unscripted"))
    job = support.submit_and_wait(client, event)
    assert job["status"] == "dead"
    assert job["attempts"] == 3


def test_ping_never_needs_the_script(client):
    job = support.submit_and_wait(client, support.ping_event())
    assert job["status"] == "succeeded"
    assert job["result"] == {"pong": True}


def test_resending_a_scripted_event_gives_the_same_result(client, events):
    first = support.submit_and_wait(client, events["evt_m4_book"])
    response = support.post_event(client, events["evt_m4_book"])
    assert response.json()["job_id"] == first["job_id"]
    again = support.get_job(client, first["job_id"])
    assert again["result"] == first["result"]
    assert again["attempts"] == first["attempts"]
