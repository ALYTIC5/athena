import os

import pytest

import support


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "smoke: safe against a deployed service (only signed ping events)")


def pytest_sessionstart(session: pytest.Session) -> None:
    """Refuse to run the full suite against anything but localhost (CONTRACT.md section 10)."""
    if os.environ.get("ATHENA_TRANSPORT"):
        return  # maintainers' contract tests use an in-process fake
    markexpr = (session.config.getoption("markexpr") or "").strip()
    if not support.is_local(support.base_url()) and markexpr != "smoke":
        pytest.exit(
            f"Refusing to run the full suite against {support.base_url()}. "
            "Only localhost is allowed, or run just the smoke tests with: pytest -m smoke",
            returncode=2,
        )


@pytest.fixture(scope="session")
def client():
    with support.make_client() as c:
        yield c


@pytest.fixture(scope="session")
def events() -> dict:
    return support.load_events()
