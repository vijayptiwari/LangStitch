"""External service config: parsing, auth resolution, header propagation."""
import base64
import importlib.util

import pytest

from langstitch import load_config, load_service_config, set_request_headers
from langstitch.services import (
    AuthConfig,
    build_service_client_kwargs,
    resolve_auth,
    select_propagated_headers,
)

HAS_HTTPX = importlib.util.find_spec("httpx") is not None


def _write(tmp_path, body: str):
    (tmp_path / "application.yaml").write_text(body, encoding="utf-8")


def test_load_service_config_camel_and_snake(tmp_path):
    _write(
        tmp_path,
        """
external_services:
  payments:
    serverUrl: https://api.pay.com
    basePath: /v1
    timeout: 15
    propagate_headers: [x-request-id, authorization]
    auth:
      type: bearer
      token: tok123
""".strip(),
    )
    load_config(tmp_path)
    svc = load_service_config("payments")
    assert svc.base_url == "https://api.pay.com/v1"
    assert svc.timeout == 15
    assert svc.propagate_headers == ["x-request-id", "authorization"]
    assert svc.auth.type == "bearer"


def test_unknown_service_raises(tmp_path):
    _write(tmp_path, "external_services: {}")
    load_config(tmp_path)
    with pytest.raises(KeyError, match="nope"):
        load_service_config("nope")


def test_env_interpolation(tmp_path, monkeypatch):
    monkeypatch.setenv("PAY_TOKEN", "secret-xyz")
    _write(
        tmp_path,
        """
external_services:
  pay:
    serverUrl: ${PAY_HOST}
    auth:
      type: bearer
      token: ${PAY_TOKEN}
""".strip(),
    )
    monkeypatch.setenv("PAY_HOST", "https://h.example.com")
    load_config(tmp_path)
    svc = load_service_config("pay")
    assert svc.server_url == "https://h.example.com"
    assert resolve_auth(svc.auth)["headers"]["Authorization"] == "Bearer secret-xyz"


def test_resolve_auth_none():
    out = resolve_auth(AuthConfig(type="none"))
    assert out["headers"] == {} and out["params"] == {} and out["oauth2"] is None


def test_resolve_auth_basic():
    out = resolve_auth(AuthConfig(type="basic", options={"username": "u", "password": "p"}))
    expected = "Basic " + base64.b64encode(b"u:p").decode()
    assert out["headers"]["Authorization"] == expected


def test_resolve_auth_bearer():
    out = resolve_auth(AuthConfig(type="bearer", options={"token": "abc"}))
    assert out["headers"]["Authorization"] == "Bearer abc"


def test_resolve_auth_api_key_header_and_query():
    h = resolve_auth(AuthConfig(type="api_key", options={"name": "X-Key", "value": "v"}))
    assert h["headers"] == {"X-Key": "v"}
    q = resolve_auth(
        AuthConfig(type="api_key", options={"name": "api_key", "value": "v", "in": "query"})
    )
    assert q["params"] == {"api_key": "v"}


def test_resolve_auth_api_key_default_name():
    out = resolve_auth(AuthConfig(type="api_key", options={"value": "v"}))
    assert out["headers"] == {"X-API-Key": "v"}


def test_resolve_auth_oauth2_spec():
    out = resolve_auth(
        AuthConfig(
            type="oauth2",
            options={
                "token_url": "https://auth/token",
                "client_id": "cid",
                "client_secret": "sec",
                "scope": "read",
            },
        )
    )
    assert out["oauth2"]["token_url"] == "https://auth/token"
    assert out["oauth2"]["client_id"] == "cid"
    assert out["oauth2"]["scope"] == "read"


def test_resolve_auth_unsupported():
    with pytest.raises(ValueError, match="unsupported auth type"):
        resolve_auth(AuthConfig(type="kerberos"))


def test_header_propagation_explicit_and_contextvar(tmp_path):
    _write(
        tmp_path,
        """
external_services:
  s:
    serverUrl: https://s
    propagate_headers: [X-Request-Id, Authorization]
""".strip(),
    )
    load_config(tmp_path)
    svc = load_service_config("s")

    # explicit source, case-insensitive match
    picked = select_propagated_headers(svc, {"x-request-id": "r1", "x-other": "no"})
    assert picked == {"X-Request-Id": "r1"}

    # contextvar source
    set_request_headers({"authorization": "Bearer t", "x-request-id": "r2"})
    picked2 = select_propagated_headers(svc)
    assert picked2 == {"X-Request-Id": "r2", "Authorization": "Bearer t"}


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_build_client_kwargs_and_real_client(tmp_path):
    import httpx

    _write(
        tmp_path,
        """
external_services:
  s:
    serverUrl: https://s.example.com
    basePath: /api
    timeout: 12
    propagate_headers: [x-request-id]
    auth:
      type: api_key
      name: X-Key
      value: secret
""".strip(),
    )
    load_config(tmp_path)
    svc = load_service_config("s")
    kwargs = build_service_client_kwargs(svc, httpx, request_headers={"x-request-id": "abc"})
    assert kwargs["base_url"] == "https://s.example.com/api"
    assert kwargs["timeout"] == 12
    assert kwargs["headers"]["X-Key"] == "secret"
    assert kwargs["headers"]["x-request-id"] == "abc"
    client = httpx.Client(**kwargs)
    assert str(client.base_url).rstrip("/") == "https://s.example.com/api"
    client.close()
