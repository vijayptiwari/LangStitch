"""Runtime base helpers: configured LLM, HTTP client, logging, and env access.

These are the factory functions generated application code calls instead of
constructing clients by hand. They read from ``application.yaml`` / ``env.yaml``
(via :func:`get_config` and ``os.environ``) and lazily import heavy, optional
dependencies (LLM frameworks, ``httpx``) so the core SDK stays lightweight.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from .config import AppConfig, load_config

__all__ = [
    "get_config",
    "reset_config_cache",
    "get_env",
    "get_secret",
    "get_logger",
    "get_http_client",
    "get_async_http_client",
    "get_llm_provider",
]

_LOGGING_CONFIGURED = False


def get_config(
    path: Optional[str] = None,
    *,
    default: Any = None,
    as_json: bool = False,
    reload: bool = False,
    root: Optional[str] = None,
) -> Any:
    """Access the active (precompiled, in-memory) application config.

    * ``get_config()`` — returns the :class:`AppConfig` runtime store.
    * ``get_config("server.port")`` — resolves a JSON path and returns the value
      (which may be a nested object/list). Missing paths return ``default``.
    * ``get_config("server", as_json=True)`` — returns the value as a JSON string.

    The store is set once at startup by :func:`langstitch.load_config` (loaded
    from ``application.json`` directly when present, else converted from
    ``application.yaml``), so lookups are just in-memory traversals.
    """
    from . import config as _config

    active = _config.get_active_config()
    if reload or root is not None or active is None:
        # Preserve the originally-loaded file (e.g. a custom properties path)
        # across reloads instead of falling back to discovery.
        properties = str(active.source) if (reload and active is not None and active.source) else None
        cfg = load_config(root, properties=properties)
    else:
        cfg = active

    if path is None:
        return cfg
    value = cfg.query(path, default)
    if as_json:
        import json

        return json.dumps(value, default=str)
    return value


def reset_config_cache() -> None:
    """Drop the cached/active config (primarily for tests / hot reload)."""
    from . import config as _config

    _config.clear_active_config()


def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """Read an environment variable (env.yaml values are already exported)."""
    return os.environ.get(key, default)


def get_secret(key: str, default: Optional[str] = None) -> Optional[str]:
    """Read a secret from the environment.

    Tries ``KEY`` then ``KEY_SECRET``/``SECRET_KEY`` style fallbacks so secrets
    declared under an ``env.yaml`` ``secrets:`` section resolve cleanly.
    """
    for candidate in (key, key.upper(), f"SECRETS_{key.upper()}"):
        if candidate in os.environ:
            return os.environ[candidate]
    return default


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a logger configured from the ``LOG_LEVEL`` env var (default INFO)."""
    global _LOGGING_CONFIGURED
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    if not _LOGGING_CONFIGURED:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        )
        _LOGGING_CONFIGURED = True
    logger = logging.getLogger(name or "langstitch")
    logger.setLevel(level)
    return logger


def _http_defaults(overrides: dict) -> dict:
    cfg = get_config()
    http_cfg = cfg.section("http", {}) or {}
    settings: dict[str, Any] = {}
    if "timeout" in http_cfg:
        settings["timeout"] = http_cfg["timeout"]
    if "base_url" in http_cfg:
        settings["base_url"] = http_cfg["base_url"]
    settings.update(overrides)
    return settings


def _require_httpx() -> Any:
    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "HTTP client requires httpx. Install it with:\n"
            "    pip install 'langstitch[http]'"
        ) from exc
    return httpx


def _client_kwargs(service: Optional[str], request_headers: Optional[dict], overrides: dict, httpx: Any) -> dict:
    if service:
        from .services import build_service_client_kwargs, load_service_config

        svc = load_service_config(service)
        return build_service_client_kwargs(
            svc, httpx, request_headers=request_headers, overrides=overrides
        )
    return _http_defaults(overrides)


def get_http_client(
    service: Optional[str] = None,
    *,
    request_headers: Optional[dict] = None,
    raw: bool = False,
    **overrides: Any,
) -> Any:
    """Return a configured :class:`~langstitch.services.ServiceClient`.

    With ``service``, configuration is read from
    ``external_services.<service>`` in ``application.yaml`` — ``base_url``
    (serverUrl + basePath), ``timeout``, propagated inbound headers, and auth
    (``none`` | ``basic`` | ``bearer`` | ``api_key`` | ``oauth2``). Without it,
    defaults come from the ``http`` section. Keyword args override everything.

    The returned client exposes ``get/post/put/patch/delete/head/options`` and
    ``request`` with path-parameter templating and per-request header/query
    merging::

        api = get_http_client("payments")
        resp = api.get("/users/{id}", path_params={"id": 7},
                       params={"expand": "wallet"}, headers={"X-Trace": "1"})

    Pass ``raw=True`` to get the underlying ``httpx.Client`` instead.
    """
    httpx = _require_httpx()
    client = httpx.Client(**_client_kwargs(service, request_headers, overrides, httpx))
    if raw:
        return client
    from .services import ServiceClient

    return ServiceClient(client)


def get_async_http_client(
    service: Optional[str] = None,
    *,
    request_headers: Optional[dict] = None,
    raw: bool = False,
    **overrides: Any,
) -> Any:
    """Return a configured :class:`~langstitch.services.AsyncServiceClient`
    (see :func:`get_http_client` for the ``service`` configuration contract).
    Pass ``raw=True`` for the underlying ``httpx.AsyncClient``."""
    httpx = _require_httpx()
    client = httpx.AsyncClient(**_client_kwargs(service, request_headers, overrides, httpx))
    if raw:
        return client
    from .services import AsyncServiceClient

    return AsyncServiceClient(client)


def get_llm_provider(
    name: Optional[str] = None,
    *,
    provider: Optional[str] = None,
    temperature: Optional[float] = None,
    **overrides: Any,
) -> Any:
    """Return a chat model configured from the ``model`` section.

    Reads ``model.provider`` / ``model.name`` / ``model.temperature`` from
    ``application.yaml`` (overridable via arguments). API keys are read from the
    environment by the provider integration (e.g. ``OPENAI_API_KEY``), which
    ``env.yaml`` populates.

    Uses LangChain's ``init_chat_model`` under the hood. Install with::

        pip install 'langstitch[llm]'   # plus the provider package, e.g. langchain-openai
    """
    cfg = get_config()
    model_cfg = cfg.section("model", {}) or {}
    provider = provider or model_cfg.get("provider", "openai")
    model_name = name or model_cfg.get("name", "gpt-4o-mini")
    if temperature is None:
        temperature = model_cfg.get("temperature")

    try:
        from langchain.chat_models import init_chat_model
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "get_llm_provider() requires LangChain. Install it with:\n"
            "    pip install 'langstitch[llm]'\n"
            "plus the provider integration, e.g. 'pip install langchain-openai'."
        ) from exc

    kwargs: dict[str, Any] = dict(overrides)
    if temperature is not None:
        kwargs["temperature"] = temperature
    return init_chat_model(model_name, model_provider=provider, **kwargs)
