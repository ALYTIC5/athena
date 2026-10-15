"""Send a signed event to your running service. Standard library only.

    python tools/send_event.py ping
    python tools/send_event.py evt_m4_book --url http://localhost:8000
    python tools/send_event.py path/to/event.json

The secret comes from the ATHENA_WEBHOOK_SECRET environment variable, never from a flag.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "events.json"


def sign(secret: str, body: bytes, timestamp: int | None = None) -> str:
    t = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={t},v1={digest}"


def load_event(name_or_path: str) -> bytes:
    path = Path(name_or_path)
    if path.exists():
        return path.read_bytes()
    events = json.loads(FIXTURES.read_text(encoding="utf-8"))
    if name_or_path not in events:
        raise SystemExit(f"Unknown event {name_or_path!r}. Choose one of: {', '.join(sorted(events))}")
    return json.dumps(events[name_or_path]).encode()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("event", help="a fixture name from fixtures/events.json, or a path to a JSON file")
    parser.add_argument("--url", default=os.environ.get("ATHENA_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--timestamp", type=int, help="override the signature timestamp (to test old signatures)")
    args = parser.parse_args()

    secret = os.environ.get("ATHENA_WEBHOOK_SECRET")
    if not secret:
        raise SystemExit("Set ATHENA_WEBHOOK_SECRET first.")
    body = load_event(args.event)
    request = urllib.request.Request(
        args.url.rstrip("/") + "/webhooks/calls",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "X-Athena-Signature": sign(secret, body, args.timestamp)},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            status, text = response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        status, text = error.code, error.read().decode()
    print(status, text)
    return 0 if status == 202 else 1


if __name__ == "__main__":
    sys.exit(main())
