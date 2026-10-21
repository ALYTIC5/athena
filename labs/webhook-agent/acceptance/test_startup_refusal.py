"""The service must refuse to start with test mode on outside test or development (CONTRACT.md section 8).

Set ATHENA_START_COMMAND to the command that starts your API, for example `uvicorn app.main:app`.
The test starts it with an unsafe environment and expects a quick non-zero exit.
"""

from __future__ import annotations

import os
import subprocess

import pytest


def _run(extra_env: dict[str, str]):
    command = os.environ.get("ATHENA_START_COMMAND")
    if not command:
        pytest.skip("Set ATHENA_START_COMMAND to the command that starts your API to run this test.")
    env = {k: v for k, v in os.environ.items() if k not in {"K_SERVICE", "CLOUD_RUN_JOB", "CLOUD_RUN_WORKER_POOL"}}
    env.pop("ATHENA_ENV", None)
    env.update({"ATHENA_TEST_MODE": "1", "PYTHONUNBUFFERED": "1", **extra_env})
    process = subprocess.Popen(command, shell=True, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        code = process.wait(timeout=float(os.environ.get("ATHENA_START_TIMEOUT", "20")))
    except subprocess.TimeoutExpired:
        process.kill()
        pytest.fail("The service kept running with an unsafe environment; it must exit during startup.")
    assert code != 0, "The service exited with status 0; it must exit with a non-zero status"
    return process


def test_refuses_test_mode_in_production():
    _run({"ATHENA_ENV": "production"})


def test_refuses_test_mode_when_the_environment_is_unset():
    _run({})


@pytest.mark.parametrize("variable", ["K_SERVICE", "CLOUD_RUN_JOB", "CLOUD_RUN_WORKER_POOL"])
def test_refuses_test_mode_on_cloud_run(variable):
    _run({"ATHENA_ENV": "test", variable: "something"})
