"""Base runtime helpers: config, env, logging, http, and llm providers."""
import importlib.util
import logging

import pytest

from langstitch import (
    get_config,
    get_env,
    get_http_client,
    get_llm_provider,
    get_logger,
    get_secret,
)
from langstitch.config import AppConfig

HAS_HTTPX = importlib.util.find_spec("httpx") is not None
HAS_LANGCHAIN = importlib.util.find_spec("langchain") is not None


def test_get_env_and_secret(monkeypatch):
    monkeypatch.setenv("MY_VAR", "value")
    monkeypatch.setenv("SECRETS_TOKEN", "abc123")
    assert get_env("MY_VAR") == "value"
    assert get_env("MISSING", "fallback") == "fallback"
    assert get_secret("token") == "abc123"
    assert get_secret("nope", "d") == "d"


def test_get_logger_respects_level(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    logger = get_logger("test.logger")
    assert isinstance(logger, logging.Logger)
    assert logger.level == logging.WARNING


def test_get_config_returns_appconfig_and_caches(tmp_path, monkeypatch):
    (tmp_path / "application.yaml").write_text("app:\n  name: cached\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    cfg1 = get_config()
    cfg2 = get_config()
    assert isinstance(cfg1, AppConfig)
    assert cfg1 is cfg2  # cached
    assert cfg1.name == "cached"


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_http_client_when_available():
    import httpx

    from langstitch import ServiceClient

    client = get_http_client(timeout=1.0)
    assert isinstance(client, ServiceClient)
    assert isinstance(get_http_client(raw=True), httpx.Client)
    client.close()


@pytest.mark.skipif(HAS_HTTPX, reason="httpx installed")
def test_http_client_helpful_error():
    with pytest.raises(RuntimeError, match="httpx"):
        get_http_client()


@pytest.mark.skipif(HAS_LANGCHAIN, reason="langchain installed")
def test_llm_provider_helpful_error():
    with pytest.raises(RuntimeError, match="LangChain"):
        get_llm_provider()
