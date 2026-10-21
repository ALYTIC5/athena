import pytest

import support


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    if "mode" in metafunc.fixturenames:
        metafunc.parametrize("mode", support.search_modes())
