import pytest

from langstitch import clear_request_headers, reset_config_cache, reset_registry


@pytest.fixture(autouse=True)
def _clean_registry():
    reset_registry()
    reset_config_cache()
    clear_request_headers()
    yield
    reset_registry()
    reset_config_cache()
    clear_request_headers()
