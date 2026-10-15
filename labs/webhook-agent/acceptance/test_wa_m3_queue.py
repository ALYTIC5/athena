"""Milestone wa-m3: a PostgreSQL job store and worker (CONTRACT.md sections 4 and 7)."""

from __future__ import annotations

import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

import support


def test_unknown_job_is_404(client):
    response = client.get("/jobs/job_does_not_exist")
    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}


def test_ping_job_has_the_documented_shape_and_succeeds_without_a_model(client):
    event = support.ping_event()
    job = support.submit_and_wait(client, event)
    assert job["event_id"] == event["event_id"]
    assert job["type"] == "ping"
    assert job["status"] == "succeeded"
    assert job["attempts"] == 1
    assert job["result"] == {"pong": True}
    assert job["error"] is None
    assert isinstance(job["worker_id"], str) and job["worker_id"]


def test_status_is_one_of_the_documented_values(client):
    response = support.post_event(client, support.ping_event())
    job = support.get_job(client, response.json()["job_id"])
    assert job["status"] in {"queued", "running", "succeeded", "dead"}


def test_a_failing_job_is_retried_and_ends_dead_after_three_attempts(client):
    event = support.call_event(type_="simulate_failure")
    started = time.monotonic()
    job = support.submit_and_wait(client, event)
    elapsed = time.monotonic() - started
    assert job["status"] == "dead"
    assert job["attempts"] == 3
    assert job["error"], "A dead job explains why in `error`"
    assert job["result"] is None
    # Test-mode backoff is 0.2 s then 0.4 s. Two retries cannot be instant, and must not take half a minute.
    assert 0.3 <= elapsed < 15, f"retries took {elapsed:.2f}s; test-mode backoff is 0.2s then 0.4s"


def test_a_job_that_is_still_retrying_is_not_dead_yet(client):
    event = support.call_event(type_="simulate_failure")
    response = support.post_event(client, event)
    job_id = response.json()["job_id"]
    seen = set()
    deadline = time.monotonic() + support.SCRIPTED_TIMEOUT
    while time.monotonic() < deadline:
        job = support.get_job(client, job_id)
        seen.add((job["status"], job["attempts"]))
        if job["status"] == "dead":
            break
        time.sleep(0.02)
    assert ("dead", 3) in seen
    assert not any(status == "dead" and attempts < 3 for status, attempts in seen), "Dead before three attempts"


def test_many_jobs_are_each_processed_exactly_once(client):
    """With two workers running, no job may be claimed twice (FOR UPDATE SKIP LOCKED)."""
    events = [support.ping_event() for _ in range(30)]
    with ThreadPoolExecutor(max_workers=10) as pool:
        responses = list(pool.map(lambda e: support.post_event(client, e), events))
    assert all(r.status_code == 202 for r in responses)
    job_ids = [r.json()["job_id"] for r in responses]
    assert len(set(job_ids)) == 30

    jobs = [support.wait_for_job(client, job_id) for job_id in job_ids]
    assert all(j["status"] == "succeeded" for j in jobs)
    assert all(j["attempts"] == 1 for j in jobs), "A job was claimed more than once"

    workers = {j["worker_id"] for j in jobs}
    if len(workers) < 2:
        pytest.skip(f"Only one worker handled the jobs ({workers}). Start two workers to test concurrency.")


def test_jobs_survive_a_restart(client):
    command = os.environ.get("ATHENA_RESTART_COMMAND")
    if not command:
        pytest.skip("Set ATHENA_RESTART_COMMAND to a command that restarts your service to run this test.")
    event = support.ping_event()
    job = support.submit_and_wait(client, event)
    subprocess.run(command, shell=True, check=True, timeout=120)
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            if client.get("/health").status_code == 200:
                break
        except Exception:
            pass
        time.sleep(0.5)
    after = support.get_job(client, job["job_id"])
    assert after["status"] == "succeeded"
    assert after["result"] == {"pong": True}
    again = support.post_event(client, event)
    assert again.json()["job_id"] == job["job_id"], "The event id must still be remembered after a restart"
