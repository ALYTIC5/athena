"""Milestone wa-m2: a signed webhook endpoint (CONTRACT.md sections 3 to 5)."""

from __future__ import annotations

import json
import time

import support


def test_health_reports_ok_and_test_mode(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["test_mode"] is True, "Run the suite against a service started with ATHENA_TEST_MODE=1 and ATHENA_ENV=test"


def test_valid_signed_event_is_accepted_with_a_job_id(client):
    response = support.post_event(client, support.ping_event())
    assert response.status_code == 202
    body = response.json()
    assert isinstance(body["job_id"], str) and body["job_id"]
    assert body["duplicate"] is False


def test_missing_signature_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    response = support.post_raw(client, body, signature=None)
    assert response.status_code == 401
    assert response.json() == {"error": "invalid_signature"}


def test_wrong_signature_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    response = support.post_raw(client, body, signature=support.sign("not the secret", body))
    assert response.status_code == 401
    assert response.json()["error"] == "invalid_signature"


def test_malformed_signature_header_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    for header in ["", "garbage", "t=abc,v1=zz", "v1=" + "0" * 64, f"t={int(time.time())}"]:
        response = support.post_raw(client, body, signature=header)
        assert response.status_code == 401, f"header {header!r} returned {response.status_code}"


def test_body_changed_after_signing_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    signature = support.sign(support.webhook_secret(), body)
    tampered = body.replace(b"ping", b"pong")
    response = support.post_raw(client, tampered, signature)
    assert response.status_code == 401


def test_old_timestamp_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    old = int(time.time()) - 301
    response = support.post_raw(client, body, support.sign(support.webhook_secret(), body, old))
    assert response.status_code == 401


def test_timestamp_from_the_future_is_401(client):
    body = json.dumps(support.ping_event()).encode()
    future = int(time.time()) + 301
    response = support.post_raw(client, body, support.sign(support.webhook_secret(), body, future))
    assert response.status_code == 401


def test_recent_timestamp_within_five_minutes_is_accepted(client):
    body = json.dumps(support.ping_event()).encode()
    recent = int(time.time()) - 240
    response = support.post_raw(client, body, support.sign(support.webhook_secret(), body, recent))
    assert response.status_code == 202


def test_bad_signature_wins_over_an_invalid_body(client):
    """The signature is checked before the body is parsed, so a bad signature never leaks body errors."""
    body = b"this is not json"
    response = support.post_raw(client, body, support.sign("not the secret", body))
    assert response.status_code == 401


def test_valid_signature_with_a_body_that_is_not_json_is_422(client):
    body = b"this is not json"
    response = support.post_raw(client, body, support.sign(support.webhook_secret(), body))
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_payload"


def test_valid_signature_with_a_wrong_shape_is_422(client):
    bad_bodies = [
        {"type": "ping", "occurred_at": "2026-11-02T09:30:00Z"},  # no event_id
        {"event_id": "", "type": "ping", "occurred_at": "2026-11-02T09:30:00Z"},  # empty event_id
        {"event_id": support.unique_id(), "type": "unknown", "occurred_at": "2026-11-02T09:30:00Z"},
        {"event_id": support.unique_id(), "type": "call.ended", "occurred_at": "2026-11-02T09:30:00Z"},  # no call
        {"event_id": 123, "type": "ping", "occurred_at": "2026-11-02T09:30:00Z"},  # wrong type
    ]
    for event in bad_bodies:
        response = support.post_event(client, event)
        assert response.status_code == 422, f"{event} returned {response.status_code}"


def test_signature_is_checked_over_the_raw_bytes_not_a_reserialised_body(client):
    """Odd spacing, key order and non-ASCII text must still verify, because the HMAC covers the exact bytes."""
    event_id = support.unique_id("evt_raw")
    body = (
        '{  "type" :"ping",\n  "occurred_at":   "2026-11-02T09:30:00Z",   "event_id":"' + event_id + '", "note": "café ☕"}'
    ).encode("utf-8")
    response = support.post_raw(client, body, support.sign(support.webhook_secret(), body))
    assert response.status_code == 202, "Verify the signature over the raw request bytes, before parsing"


def test_same_event_id_again_returns_the_same_job_id(client):
    event = support.ping_event()
    first = support.post_event(client, event)
    second = support.post_event(client, event)
    assert first.status_code == 202 and second.status_code == 202
    assert second.json()["job_id"] == first.json()["job_id"]
    assert first.json()["duplicate"] is False
    assert second.json()["duplicate"] is True


def test_different_event_ids_get_different_jobs(client):
    first = support.post_event(client, support.ping_event())
    second = support.post_event(client, support.ping_event())
    assert first.json()["job_id"] != second.json()["job_id"]


def test_a_duplicate_does_not_create_a_second_job_even_when_resent_at_once(client):
    event = support.ping_event()
    job_ids = {support.post_event(client, event).json()["job_id"] for _ in range(5)}
    assert len(job_ids) == 1
