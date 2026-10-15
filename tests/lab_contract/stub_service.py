"""A stand-in for a learner's service, used to test the startup-refusal suite.

It starts, or refuses to start, the way CONTRACT.md section 8 says. STUB_FLAWS makes it wrong:
never_refuse, ignore_unset_env, ignore_cloud_run.
"""

import os
import sys
import time

flaws = {f for f in os.environ.get("STUB_FLAWS", "").split(",") if f}
test_mode = os.environ.get("ATHENA_TEST_MODE") == "1"
env = os.environ.get("ATHENA_ENV")
cloud = any(os.environ.get(v) for v in ("K_SERVICE", "CLOUD_RUN_JOB", "CLOUD_RUN_WORKER_POOL"))

unsafe_env = env not in ("test", "development")
if "ignore_unset_env" in flaws:
    unsafe_env = env == "production"
if "ignore_cloud_run" in flaws:
    cloud = False
if "never_refuse" in flaws:
    unsafe_env, cloud = False, False

if test_mode and (unsafe_env or cloud):
    print("refusing to start: test mode is not allowed here", file=sys.stderr)
    sys.exit(3)
time.sleep(60)
