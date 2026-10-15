"""Helpers shared by the Lab A acceptance tests.

Everything here talks to your running service over HTTP. Nothing imports your code.
"""

from __future__ import annotations

import hashlib
import hmac
import importlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}
SIGNATURE_HEADER = "X-Athena-Signature"
SCRIPTED_TIMEOUT = 20.0


def base_url() -> str:
    return os.environ.get("ATHENA_BASE_URL", "http://localhost:8000").rstrip("/")


def is_local(url: str) -> bool:
    return (urlparse(url).hostname or "") in LOCAL_HOSTS


def webhook_secret() -> str:
    secret = os.environ.get("ATHENA_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("Set ATHENA_WEBHOOK_SECRET to the same secret your service uses.")
    return secret


def sign(secret: str, body: bytes, timestamp: int | None = None) -> str:
    """The X-Athena-Signature header value for a raw body (CONTRACT.md section 3)."""
    t = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={t},v1={digest}"


def transport() -> httpx.BaseTransport | None:
    """Real network by default. The maintainers' contract tests swap in a fake service
    through ATHENA_TRANSPORT=module:factory. You can ignore this."""
    spec = os.environ.get("ATHENA_TRANSPORT")
    if not spec:
        return None
    module_name, attr = spec.split(":", 1)
    factory: Callable[[], httpx.BaseTransport] = getattr(importlib.import_module(module_name), attr)
    return factory()


def make_client() -> httpx.Client:
    return httpx.Client(base_url=base_url(), transport=transport(), timeout=10.0)


def load_events() -> dict[str, dict[str, Any]]:
    return json.loads((FIXTURES / "events.json").read_text(encoding="utf-8"))


def unique_id(prefix: str = "evt") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def ping_event(event_id: str | None = None) -> dict[str, Any]:
    return {
        "event_id": event_id or unique_id("evt_ping"),
        "type": "ping",
        "occurred_at": "2026-11-02T09:30:00Z",
    }


def call_event(event_id: str | None = None, type_: str = "call.ended", name: str = "Test Caller") -> dict[str, Any]:
    eid = event_id or unique_id("evt_call")
    return {
        "event_id": eid,
        "type": type_,
        "occurred_at": "2026-11-02T09:30:00Z",
        "call": {
            "call_id": f"call_{eid}",
            "caller": {"name": name, "phone": "+44 7700 900150"},
            "transcript": "Hello, this is a test call.",
        },
    }


def post_raw(client: httpx.Client, body: bytes, signature: str | None) -> httpx.Response:
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers[SIGNATURE_HEADER] = signature
    return client.post("/webhooks/calls", content=body, headers=headers)


def post_event(client: httpx.Client, event: dict[str, Any], *, timestamp: int | None = None) -> httpx.Response:
    """Send an event with a valid signature over its exact serialised bytes."""
    body = json.dumps(event).encode()
    return post_raw(client, body, sign(webhook_secret(), body, timestamp))


def get_job(client: httpx.Client, job_id: str) -> dict[str, Any]:
    response = client.get(f"/jobs/{job_id}")
    assert response.status_code == 200, f"GET /jobs/{job_id} returned {response.status_code}: {response.text}"
    return response.json()


def wait_for_job(
    client: httpx.Client,
    job_id: str,
    *,
    states: tuple[str, ...] = ("succeeded", "dead"),
    timeout: float = SCRIPTED_TIMEOUT,
) -> dict[str, Any]:
    """Poll GET /jobs/{id} until the status is one of `states` (never a fixed sleep)."""
    deadline = time.monotonic() + timeout
    job: dict[str, Any] = {}
    while time.monotonic() < deadline:
        job = get_job(client, job_id)
        if job["status"] in states:
            return job
        time.sleep(0.1)
    raise AssertionError(f"Job {job_id} did not reach {states} within {timeout}s; last state: {job}")


def submit_and_wait(client: httpx.Client, event: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    response = post_event(client, event)
    assert response.status_code == 202, f"POST /webhooks/calls returned {response.status_code}: {response.text}"
    return wait_for_job(client, response.json()["job_id"], **kwargs)


def bookings(client: httpx.Client) -> list[dict[str, Any]]:
    response = client.get("/bookings")
    assert response.status_code == 200, f"GET /bookings returned {response.status_code}"
    return response.json()["bookings"]
