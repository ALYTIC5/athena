"""Milestone wa-m7: smoke tests for the deployed service (CONTRACT.md section 10).

Run with `pytest -m smoke` against your deployed URL. These tests only send signed `ping` events,
which never call a model, so they are safe against production.
"""

from __future__ import annotations

import json

import pytest

import support

pytestmark = pytest.mark.smoke


def test_deployed_health_says_test_mode_is_off(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["test_mode"] is False, "The fake model must never be reachable in production"


def test_deployed_service_rejects_a_bad_signature(client):
    body = json.dumps(support.ping_event()).encode()
    response = support.post_raw(client, body, support.sign("not the secret", body))
    assert response.status_code == 401


def test_deployed_service_accepts_a_signed_ping(client):
    response = support.post_event(client, support.ping_event())
    assert response.status_code == 202
    assert response.json()["job_id"]


def test_repeating_a_ping_returns_the_same_job(client):
    event = support.ping_event()
    first = support.post_event(client, event)
    second = support.post_event(client, event)
    assert second.status_code == 202
    assert second.json()["job_id"] == first.json()["job_id"]
