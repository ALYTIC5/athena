"""Lab A: the acceptance suites are tested against fakes, not against a real service.

Each suite must pass the correct fake and fail against several deliberately broken fakes
(docs/SPEC.md section 10). The suites run in a separate pytest process, as a learner would run them.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
LAB = HERE.parent.parent / "labs" / "webhook-agent"
ACCEPTANCE = LAB / "acceptance"
STUB = HERE / "stub_service.py"


def run_suite(
    suite: str,
    *,
    flaws: str = "",
    test_mode: str = "1",
    extra_args: tuple[str, ...] = (),
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = {
        **os.environ,
        "ATHENA_TRANSPORT": "lab_fakes:make_transport",
        "ATHENA_FAKE_FLAWS": flaws,
        "ATHENA_FAKE_TEST_MODE": test_mode,
        "ATHENA_WEBHOOK_SECRET": "ATHENA_FAKE_contract_test_secret",
        "ATHENA_BASE_URL": "http://localhost:8000",
        "PYTHONPATH": os.pathsep.join([str(HERE), str(ACCEPTANCE)]),
        **(extra_env or {}),
    }
    return subprocess.run(
        [sys.executable, "-m", "pytest", str(ACCEPTANCE / suite), "-q", "-p", "no:cacheprovider", *extra_args],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(LAB),
        timeout=300,
    )


def tail(result: subprocess.CompletedProcess[str]) -> str:
    return (result.stdout + result.stderr)[-1800:]


# (suite file, flawed fakes). Every flaw must make its suite fail.
SUITES: dict[str, list[str]] = {
    "test_wa_m2_webhook.py": [
        "no_signature_check",
        "accept_old_timestamps",
        "reserialise_before_verify",
        "duplicate_makes_new_job",
    ],
    "test_wa_m3_queue.py": ["never_dead", "double_claim", "dead_after_one_attempt", "no_worker_id"],
    "test_wa_m4_classify.py": ["wrong_intent", "skip_validation", "bad_confidence"],
    "test_wa_m5_agent.py": [
        "injection_books",
        "too_many_steps",
        "no_escalation",
        "no_one_booking_limit",
    ],
}


@pytest.mark.parametrize("suite", sorted(SUITES))
def test_suite_passes_the_correct_fake(suite):
    result = run_suite(suite)
    assert result.returncode == 0, f"{suite} should pass the correct fake:\n{tail(result)}"


def _flaw_cases():
    return [(suite, flaw) for suite, flaws in sorted(SUITES.items()) for flaw in flaws]


@pytest.mark.parametrize(("suite", "flaw"), _flaw_cases())
def test_suite_fails_a_broken_fake(suite, flaw):
    result = run_suite(suite, flaws=flaw)
    assert result.returncode != 0, f"{suite} should fail when the service has the flaw {flaw!r}:\n{tail(result)}"


def test_each_suite_has_at_least_three_broken_fakes():
    assert all(len(flaws) >= 3 for flaws in SUITES.values())


# ---- smoke ------------------------------------------------------------------------------------


def test_smoke_passes_a_correct_deployed_fake():
    result = run_suite("test_wa_m7_smoke.py", test_mode="0", extra_args=("-m", "smoke"))
    assert result.returncode == 0, tail(result)


@pytest.mark.parametrize("flaw", ["test_mode_in_production", "ping_rejected", "no_signature_check", "duplicate_makes_new_job"])
def test_smoke_fails_a_broken_deployed_fake(flaw):
    result = run_suite("test_wa_m7_smoke.py", flaws=flaw, test_mode="0", extra_args=("-m", "smoke"))
    assert result.returncode != 0, f"smoke should fail with {flaw!r}:\n{tail(result)}"


def test_the_full_suite_refuses_a_non_local_url():
    result = run_suite(
        "test_wa_m2_webhook.py",
        extra_env={"ATHENA_TRANSPORT": "", "ATHENA_BASE_URL": "https://example.com"},
    )
    assert result.returncode == 2
    assert "Refusing to run the full suite" in result.stdout + result.stderr


def test_the_smoke_marker_is_allowed_against_a_non_local_url():
    result = run_suite(
        "test_wa_m7_smoke.py",
        test_mode="0",
        extra_args=("-m", "smoke"),
        extra_env={"ATHENA_BASE_URL": "https://my-service.example.com"},
    )
    assert result.returncode == 0, tail(result)


# ---- startup refusal ---------------------------------------------------------------------------

START = f'"{sys.executable}" "{STUB}"'


def refusal(flaws: str = ""):
    return run_suite(
        "test_startup_refusal.py",
        extra_env={"ATHENA_START_COMMAND": START, "ATHENA_START_TIMEOUT": "4", "STUB_FLAWS": flaws},
    )


def test_startup_refusal_passes_a_service_that_refuses():
    result = refusal()
    assert result.returncode == 0, tail(result)
    assert "5 passed" in result.stdout


@pytest.mark.parametrize("flaw", ["never_refuse", "ignore_unset_env", "ignore_cloud_run"])
def test_startup_refusal_fails_a_service_that_does_not(flaw):
    result = refusal(flaw)
    assert result.returncode != 0, f"should fail for {flaw!r}:\n{tail(result)}"


def test_startup_refusal_is_skipped_without_a_start_command():
    result = run_suite("test_startup_refusal.py", extra_env={"ATHENA_START_COMMAND": ""})
    assert result.returncode == 0
    assert "skipped" in result.stdout
