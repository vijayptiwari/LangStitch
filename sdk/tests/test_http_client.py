"""ServiceClient: methods, path params, query params, header merging."""
import importlib.util

import pytest

from langstitch import format_path, get_http_client, load_config

HAS_HTTPX = importlib.util.find_spec("httpx") is not None


def test_format_path_pure():
    assert format_path("/users/{id}", {"id": 7}) == "/users/7"
    assert format_path("/a/{x}/b/{y}", {"x": 1, "y": "p q"}) == "/a/1/b/p%20q"
    assert format_path("/no/params") == "/no/params"
    with pytest.raises(KeyError, match="missing path parameter"):
        format_path("/users/{id}", {"wrong": 1})


def _write_service(tmp_path):
    (tmp_path / "application.yaml").write_text(
        """
external_services:
  s:
    serverUrl: https://svc.test
    basePath: /api
    auth:
      type: api_key
      name: X-Key
      value: secret
""".strip(),
        encoding="utf-8",
    )


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_methods_path_query_header_merge(tmp_path):
    import httpx

    _write_service(tmp_path)
    load_config(tmp_path)

    captured = {}

    def handler(request: "httpx.Request") -> "httpx.Response":
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        return httpx.Response(200, json={"ok": True})

    client = get_http_client("s", transport=httpx.MockTransport(handler))

    r = client.get(
        "/users/{id}/orders/{order_id}",
        path_params={"id": 7, "order_id": "ab"},
        params={"expand": "wallet"},
        headers={"X-Trace": "t1"},
    )
    assert r.status_code == 200
    assert captured["method"] == "GET"
    assert captured["url"] == "https://svc.test/api/users/7/orders/ab?expand=wallet"
    # auth header from config + per-request header both present
    assert captured["headers"]["x-key"] == "secret"
    assert captured["headers"]["x-trace"] == "t1"

    # POST with json body and a different method
    client.post("/users", json={"name": "x"})
    assert captured["method"] == "POST"
    assert captured["url"] == "https://svc.test/api/users"

    # PUT / PATCH / DELETE all routed
    for method, fn in [("PUT", client.put), ("PATCH", client.patch), ("DELETE", client.delete)]:
        fn("/users/{id}", path_params={"id": 1})
        assert captured["method"] == method
        assert captured["url"] == "https://svc.test/api/users/1"

    client.close()


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_header_helpers_and_delegation(tmp_path):
    import httpx

    _write_service(tmp_path)
    load_config(tmp_path)
    client = get_http_client("s", transport=httpx.MockTransport(lambda r: httpx.Response(204)))

    client.set_header("X-Tenant", "acme")
    client.add_headers({"X-Region": "eu"})
    assert client.headers["X-Tenant"] == "acme"
    assert client.headers["X-Region"] == "eu"
    client.remove_header("X-Region")
    assert "X-Region" not in client.headers
    # delegation to the underlying httpx client
    assert str(client.base_url).rstrip("/") == "https://svc.test/api"
    client.close()


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_async_client_structure_and_path_via_event_loop(tmp_path):
    import asyncio

    import httpx

    from langstitch import AsyncServiceClient, get_async_http_client

    _write_service(tmp_path)
    load_config(tmp_path)
    captured = {}

    def handler(request):
        captured["url"] = str(request.url)
        captured["method"] = request.method
        return httpx.Response(200)

    client = get_async_http_client("s", transport=httpx.MockTransport(handler))
    assert isinstance(client, AsyncServiceClient)

    async def _run():
        await client.get("/ping/{id}", path_params={"id": 9}, params={"q": "1"})
        await client.post("/ping", json={"a": 1})
        await client.aclose()

    asyncio.run(_run())
    assert captured["url"] == "https://svc.test/api/ping"  # last call (POST)
    assert captured["method"] == "POST"
