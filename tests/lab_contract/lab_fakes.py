"""Table-driven fake services for testing the Lab A acceptance suites.

There is no real queue, worker, agent or database here: every answer is canned for the fixture
events (labs/webhook-agent/fixtures/events.json). A fake can be built correct, or with one or more
deliberate flaws. Each suite must pass the correct fake and fail every flawed one.

Selected through the environment, because the suites run in a separate pytest process:

    ATHENA_TRANSPORT=lab_fakes:make_transport
    ATHENA_FAKE_FLAWS=no_signature_check,double_claim
    ATHENA_FAKE_TEST_MODE=1
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import threading
import time
from typing import Any

import httpx

SECRET = "ATHENA_FAKE_contract_test_secret"
INTENTS = {"book", "cancel", "billing_question", "other"}
TYPES = {"call.ended", "ping", "simulate_failure"}
DEAD_AFTER = 0.7  # seconds: attempt 2 starts at 0.2, attempt 3 at 0.6 (test-mode backoff)


def _final(n: int) -> dict[str, Any]:
    return {"n": n, "action": "final", "name": None}


def _tool(n: int, name: str) -> dict[str, Any]:
    return {"n": n, "action": "tool_call", "name": name}


def _classified(intent: str, summary: str, name: str, confidence: float, steps: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "intent": intent,
        "summary": summary,
        "caller_name": name,
        "confidence": confidence,
        "escalated": False,
        "escalation_reason": None,
        "bookings": [],
        "steps": steps,
    }


def _escalated(reason: str, steps: list[dict[str, Any]], bookings: list[str] | None = None) -> dict[str, Any]:
    return {
        "intent": "other",
        "summary": "A person needs to take over this call.",
        "caller_name": "unknown",
        "confidence": 0.5,
        "escalated": True,
        "escalation_reason": reason,
        "bookings": bookings or [],
        "steps": steps,
    }


# The table: canned results keyed by event_id.
CANNED: dict[str, dict[str, Any]] = {
    "evt_m4_book": _classified("book", "Amara wants to book a morning visit on 2 November.", "Amara Okafor", 0.93, [_final(1)]),
    "evt_m4_cancel": _classified("cancel", "Jonas cannot make his Thursday appointment and wants to cancel it.", "Jonas Weber", 0.88, [_final(1)]),
    "evt_m4_billing": _classified("billing_question", "Mei asks why her last invoice was higher than usual.", "Mei Tanaka", 0.81, [_final(1)]),
    "evt_m4_other": _classified("other", "Sofia is asking for the opening hours.", "Sofia Reyes", 0.7, [_final(1)]),
    "evt_m4_invalid_then_valid": _classified(
        "billing_question", "Kofi wants to know about a duplicate charge.", "Kofi Mensah", 0.84, [_final(1), _final(2)]
    ),
    "evt_m5_book": _classified(
        "book",
        "Booked Amara for 10:00 on 2 November.",
        "Amara Okafor",
        0.95,
        [_tool(1, "lookup_availability"), _tool(2, "create_booking"), _final(3)],
    ),
    "evt_m5_escalate": _escalated(
        "Caller is upset about a missed appointment and asks for a manager.", [_tool(1, "escalate_to_human")]
    ),
    "evt_m5_wrong_name": _escalated("blocked_action", [_tool(1, "create_booking")]),
    "evt_m5_injection": _escalated("blocked_action", [_tool(1, "create_booking")]),
    "evt_m5_bad_tool": _classified(
        "other",
        "Asked about availability, nothing to book.",
        "Ines Duarte",
        0.72,
        [_tool(1, "delete_all_bookings"), _tool(2, "lookup_availability"), _final(3)],
    ),
}


class FakeService:
    def __init__(self, flaws: set[str], test_mode: bool):
        self.flaws = flaws
        self.test_mode = test_mode
        self.lock = threading.Lock()
        self.jobs: dict[str, dict[str, Any]] = {}
        self.by_event: dict[str, str] = {}
        self.bookings: list[dict[str, Any]] = []

    # ---- request routing ---------------------------------------------------------------
    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET" and path == "/health":
            return httpx.Response(200, json={"status": "ok", "test_mode": self.test_mode})
        if request.method == "POST" and path == "/webhooks/calls":
            return self._webhook(request)
        if request.method == "GET" and path.startswith("/jobs/"):
            return self._job(path.removeprefix("/jobs/"))
        if request.method == "GET" and path == "/bookings":
            with self.lock:
                return httpx.Response(200, json={"bookings": list(self.bookings)})
        return httpx.Response(404, json={"error": "not_found"})

    # ---- the webhook ----------------------------------------------------------------------
    def _verified(self, request: httpx.Request, body: bytes) -> bool:
        if "no_signature_check" in self.flaws:
            return True
        header = request.headers.get("X-Athena-Signature", "")
        parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
        try:
            t = int(parts["t"])
            given = parts["v1"]
        except (KeyError, ValueError):
            return False
        if "accept_old_timestamps" not in self.flaws and abs(time.time() - t) > 300:
            return False
        signed = body
        if "reserialise_before_verify" in self.flaws:
            signed = json.dumps(json.loads(body)).encode()
        expected = hmac.new(SECRET.encode(), f"{t}.".encode() + signed, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, given)

    def _webhook(self, request: httpx.Request) -> httpx.Response:
        body = request.content
        if "reserialise_before_verify" in self.flaws:
            try:
                json.loads(body)
            except ValueError:
                return httpx.Response(422, json={"error": "invalid_payload", "detail": "not json"})
        if not self._verified(request, body):
            return httpx.Response(401, json={"error": "invalid_signature"})
        if "ping_rejected" in self.flaws:
            return httpx.Response(401, json={"error": "invalid_signature"})
        try:
            event = json.loads(body)
        except ValueError:
            return httpx.Response(422, json={"error": "invalid_payload", "detail": "not json"})
        problem = self._invalid(event)
        if problem:
            return httpx.Response(422, json={"error": "invalid_payload", "detail": problem})

        with self.lock:
            existing = self.by_event.get(event["event_id"])
            if existing and "duplicate_makes_new_job" not in self.flaws:
                return httpx.Response(202, json={"job_id": existing, "status": "queued", "duplicate": True})
            n = len(self.jobs) + 1
            job_id = f"job_{n}"
            self.by_event[event["event_id"]] = job_id
            self.jobs[job_id] = {"event": event, "created": time.monotonic(), "worker": "ab"[n % 2]}
            self._side_effects(job_id, event)
            return httpx.Response(202, json={"job_id": job_id, "status": "queued", "duplicate": False})

    @staticmethod
    def _invalid(event: Any) -> str | None:
        if not isinstance(event, dict):
            return "body must be an object"
        if not isinstance(event.get("event_id"), str) or not event["event_id"]:
            return "event_id"
        if event.get("type") not in TYPES:
            return "type"
        if not isinstance(event.get("occurred_at"), str):
            return "occurred_at"
        if event["type"] != "ping":
            call = event.get("call")
            if not isinstance(call, dict) or not isinstance(call.get("caller"), dict):
                return "call"
        return None

    # ---- bookings made by canned scenarios -------------------------------------------------
    def _side_effects(self, job_id: str, event: dict[str, Any]) -> None:
        eid = event["event_id"]

        def add(name: str, date: str, time_: str) -> str:
            booking_id = f"bk_{len(self.bookings) + 1}"
            self.bookings.append(
                {"booking_id": booking_id, "caller_name": name, "date": date, "time": time_, "created_by_job": job_id}
            )
            return booking_id

        if eid == "evt_m5_book":
            self.jobs[job_id]["booking_ids"] = [add("Amara Okafor", "2026-11-02", "10:00")]
        elif eid == "evt_m5_double_book":
            ids = [add("Ravi Patel", "2026-11-03", "09:00")]
            if "no_one_booking_limit" in self.flaws:
                ids.append(add("Ravi Patel", "2026-11-03", "10:00"))
            self.jobs[job_id]["booking_ids"] = ids
        elif eid == "evt_m5_injection" and "injection_books" in self.flaws:
            self.jobs[job_id]["booking_ids"] = [add("Attacker Ltd", "2026-11-06", f"{9 + i}:00") for i in range(3)]

    # ---- job status over time -----------------------------------------------------------------
    def _job(self, job_id: str) -> httpx.Response:
        with self.lock:
            job = self.jobs.get(job_id)
            if job is None:
                return httpx.Response(404, json={"error": "not_found"})
            event = job["event"]
            elapsed = time.monotonic() - job["created"]
            body: dict[str, Any] = {
                "job_id": job_id,
                "event_id": event["event_id"],
                "type": event["type"],
                "status": "succeeded",
                "attempts": 1,
                "worker_id": job["worker"],
                "result": None,
                "error": None,
            }
            kind = self._outcome(event)
            if "no_worker_id" in self.flaws:
                body["worker_id"] = None
            if kind == "dead":
                if "dead_after_one_attempt" in self.flaws:
                    body.update(status="dead", attempts=1, error="attempt failed")
                elif "never_dead" in self.flaws:
                    body.update(status="queued", attempts=1 if elapsed < 0.2 else 2, error="attempt failed")
                elif elapsed < DEAD_AFTER:
                    body.update(status="queued", attempts=1 if elapsed < 0.2 else 2, error="attempt failed")
                else:
                    body.update(status="dead", attempts=3, error="attempt failed")
            elif kind == "ping":
                body.update(result={"pong": True}, attempts=2 if "double_claim" in self.flaws else 1)
            else:
                body["result"] = self._result(job, event)
            return httpx.Response(200, json=body)

    def _outcome(self, event: dict[str, Any]) -> str:
        if event["type"] == "ping":
            return "ping"
        if event["type"] == "simulate_failure":
            return "dead"
        if event["event_id"] == "evt_m4_always_invalid" and "skip_validation" not in self.flaws:
            return "dead"
        if event["event_id"] in CANNED or event["event_id"] in {"evt_m4_always_invalid", "evt_m5_double_book"}:
            return "ok"
        return "dead"  # unscripted events fail in test mode

    def _result(self, job: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
        eid = event["event_id"]
        if eid == "evt_m4_always_invalid":  # only reached with the skip_validation flaw
            return _classified("refund", "x", "Lena Fischer", 0.5, [_final(1), _final(2)])
        if eid == "evt_m5_double_book":
            ids = job.get("booking_ids", [])
            return {
                **_escalated("blocked_action", [_tool(1, "create_booking"), _tool(2, "create_booking")], ids),
                "caller_name": "Ravi Patel",
            }
        result = json.loads(json.dumps(CANNED[eid]))
        if eid == "evt_m5_book":
            result["bookings"] = job.get("booking_ids", [])
        if eid == "evt_m5_injection":
            result["bookings"] = job.get("booking_ids", [])
            if "injection_books" in self.flaws:
                result["escalated"], result["escalation_reason"] = False, None
            if "too_many_steps" in self.flaws:
                result["steps"] = [_tool(i, "create_booking") for i in range(1, 9)]
        if eid == "evt_m5_escalate" and "no_escalation" in self.flaws:
            result["escalated"], result["escalation_reason"] = False, None
        if "wrong_intent" in self.flaws and result["intent"] != "other":
            result["intent"] = "other"
        if "bad_confidence" in self.flaws:
            result["confidence"] = 7
        return result


def make_transport() -> httpx.MockTransport:
    flaws = {f for f in os.environ.get("ATHENA_FAKE_FLAWS", "").split(",") if f}
    test_mode = os.environ.get("ATHENA_FAKE_TEST_MODE", "1") == "1"
    if "test_mode_in_production" in flaws:
        test_mode = True
    return httpx.MockTransport(FakeService(flaws, test_mode))
