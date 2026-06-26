"""External service configuration, auth, and header propagation.

Declare downstream HTTP services in ``application.yaml``::

    external_services:
      payments:
        serverUrl: https://api.payments.com   # or server_url
        basePath: /v1                          # or base_path
        timeout: 30
        propagate_headers: [x-request-id, authorization]
        auth:
          type: bearer            # none | basic | bearer | api_key | oauth2
          token: ${PAYMENTS_TOKEN}

`get_http_client("payments")` then returns an ``httpx.Client`` with ``base_url``,
timeout, propagated inbound headers, and auth already wired in.

Auth types
----------
* ``none``    — no credentials.
* ``basic``   — ``username`` + ``password`` -> ``Authorization: Basic <b64>``.
* ``bearer``  — ``token`` -> ``Authorization: Bearer <token>``.
* ``api_key`` — ``name`` (header/query key, default ``X-API-Key``), ``value``,
  ``in`` = ``header`` (default) or ``query``.
* ``oauth2``  — client-credentials: ``token_url``, ``client_id``,
  ``client_secret``, optional ``scope`` / ``audience``. The token is fetched on
  first use and cached/refreshed automatically.

Any string value supports ``${ENV_VAR}`` interpolation, so secrets live in
``env.yaml`` / the environment rather than in ``application.yaml``.
"""
from __future__ import annotations

import base64
import contextvars
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

__all__ = [
    "AuthConfig",
    "ServiceConfig",
    "load_service_config",
    "resolve_auth",
    "select_propagated_headers",
    "set_request_headers",
    "get_request_headers",
    "clear_request_headers",
    "build_service_client_kwargs",
]

_ENV_REF = re.compile(r"\$\{([^}]+)\}")

# Inbound request headers for the current task/request, used for propagation.
_REQUEST_HEADERS: "contextvars.ContextVar[Optional[Dict[str, str]]]" = contextvars.ContextVar(
    "langstitch_request_headers", default=None
)


def set_request_headers(headers: Dict[str, str]) -> Any:
    """Record the current inbound request headers (call this in middleware).

    Returns a token usable with :func:`clear_request_headers` to reset.
    """
    return _REQUEST_HEADERS.set(dict(headers or {}))


def get_request_headers() -> Optional[Dict[str, str]]:
    return _REQUEST_HEADERS.get()


def clear_request_headers(token: Any = None) -> None:
    if token is not None:
        _REQUEST_HEADERS.reset(token)
    else:
        _REQUEST_HEADERS.set(None)


def _resolve(value: Any) -> Any:
    if isinstance(value, str):
        return _ENV_REF.sub(lambda m: os.environ.get(m.group(1), ""), value)
    return value


@dataclass
class AuthConfig:
    type: str = "none"
    options: Dict[str, Any] = field(default_factory=dict)

    def option(self, *keys: str, default: Any = None) -> Any:
        for key in keys:
            if key in self.options:
                return _resolve(self.options[key])
        return default


@dataclass
class ServiceConfig:
    name: str
    server_url: str = ""
    base_path: str = ""
    propagate_headers: List[str] = field(default_factory=list)
    timeout: Optional[float] = None
    auth: AuthConfig = field(default_factory=AuthConfig)
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def base_url(self) -> str:
        server = (self.server_url or "").rstrip("/")
        path = (self.base_path or "").strip("/")
        if server and path:
            return f"{server}/{path}"
        return server


def load_service_config(name: str, cfg: Any = None) -> ServiceConfig:
    """Load and resolve a single external service's configuration."""
    if cfg is None:
        from .providers import get_config

        cfg = get_config()
    services = cfg.section("external_services", {}) or {}
    raw = services.get(name)
    if raw is None:
        raise KeyError(
            f"external service {name!r} is not configured under 'external_services' "
            "in application.yaml"
        )

    auth_raw = raw.get("auth") or {}
    auth = AuthConfig(
        type=str(auth_raw.get("type", "none") or "none").lower(),
        options={k: v for k, v in auth_raw.items() if k != "type"},
    )
    return ServiceConfig(
        name=name,
        server_url=_resolve(raw.get("serverUrl", raw.get("server_url", ""))),
        base_path=raw.get("basePath", raw.get("base_path", "")),
        propagate_headers=list(raw.get("propagate_headers", []) or []),
        timeout=raw.get("timeout"),
        auth=auth,
        raw=raw,
    )


def resolve_auth(auth: AuthConfig) -> Dict[str, Any]:
    """Turn an :class:`AuthConfig` into request material.

    Returns a dict with optional keys: ``headers``, ``params``, and ``oauth2``
    (a spec the client layer turns into an httpx auth flow). None of this needs
    httpx, so it is fully unit-testable.
    """
    kind = (auth.type or "none").lower()
    out: Dict[str, Any] = {"headers": {}, "params": {}, "oauth2": None}

    if kind in ("none", ""):
        return out

    if kind == "basic":
        user = auth.option("username", "user", default="") or ""
        password = auth.option("password", "pass", default="") or ""
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        out["headers"]["Authorization"] = f"Basic {token}"
        return out

    if kind == "bearer":
        token = auth.option("token", "access_token", default="") or ""
        out["headers"]["Authorization"] = f"Bearer {token}"
        return out

    if kind == "api_key":
        key_name = auth.option("name", "header", "key", default="X-API-Key")
        value = auth.option("value", "key_value", default="") or ""
        location = str(auth.option("in", "location", default="header")).lower()
        if location == "query":
            out["params"][key_name] = value
        else:
            out["headers"][key_name] = value
        return out

    if kind == "oauth2":
        out["oauth2"] = {
            "token_url": auth.option("token_url", "tokenUrl", default=""),
            "client_id": auth.option("client_id", "clientId", default=""),
            "client_secret": auth.option("client_secret", "clientSecret", default=""),
            "scope": auth.option("scope", default=None),
            "audience": auth.option("audience", default=None),
        }
        return out

    raise ValueError(f"unsupported auth type {auth.type!r} for service auth")


def select_propagated_headers(
    service: ServiceConfig, source: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    """Pick the configured ``propagate_headers`` from the inbound request."""
    src = source if source is not None else get_request_headers()
    if not src or not service.propagate_headers:
        return {}
    lower = {k.lower(): v for k, v in src.items()}
    picked: Dict[str, str] = {}
    for header in service.propagate_headers:
        val = lower.get(header.lower())
        if val is not None:
            picked[header] = val
    return picked


def _make_oauth2_auth(httpx: Any, spec: Dict[str, Any]) -> Any:
    """Build (and cache) an httpx Auth implementing client-credentials flow."""
    cache_key = (spec["token_url"], spec["client_id"], spec.get("scope"), spec.get("audience"))
    cached = _OAUTH2_CACHE.get(cache_key)
    if cached is not None:
        return cached

    class _ClientCredentialsAuth(httpx.Auth):
        def __init__(self) -> None:
            self._token: Optional[str] = None
            self._expiry: float = 0.0

        def _fetch(self) -> str:
            if self._token and time.time() < (self._expiry - 30):
                return self._token
            data = {
                "grant_type": "client_credentials",
                "client_id": spec["client_id"],
                "client_secret": spec["client_secret"],
            }
            if spec.get("scope"):
                data["scope"] = spec["scope"]
            if spec.get("audience"):
                data["audience"] = spec["audience"]
            resp = httpx.post(spec["token_url"], data=data)
            resp.raise_for_status()
            payload = resp.json()
            self._token = payload["access_token"]
            self._expiry = time.time() + float(payload.get("expires_in", 3600))
            return self._token

        def sync_auth_flow(self, request):  # type: ignore[override]
            request.headers["Authorization"] = f"Bearer {self._fetch()}"
            yield request

    auth = _ClientCredentialsAuth()
    _OAUTH2_CACHE[cache_key] = auth
    return auth


_OAUTH2_CACHE: Dict[Any, Any] = {}


def build_service_client_kwargs(
    service: ServiceConfig,
    httpx: Any,
    *,
    request_headers: Optional[Dict[str, str]] = None,
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble the kwargs for ``httpx.Client(**kwargs)`` for a service."""
    kwargs: Dict[str, Any] = {}
    if service.base_url:
        kwargs["base_url"] = service.base_url
    if service.timeout is not None:
        kwargs["timeout"] = service.timeout

    headers: Dict[str, str] = {}
    headers.update(select_propagated_headers(service, request_headers))

    auth_material = resolve_auth(service.auth)
    headers.update(auth_material["headers"])
    if auth_material["params"]:
        kwargs["params"] = auth_material["params"]
    if auth_material["oauth2"]:
        kwargs["auth"] = _make_oauth2_auth(httpx, auth_material["oauth2"])

    if headers:
        kwargs["headers"] = headers
    if overrides:
        kwargs.update(overrides)
    return kwargs
