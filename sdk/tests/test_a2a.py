"""A2A protocol: models, decorators, and the auth + RBAC layers."""
import importlib.util

import pytest

from langstitch import (
    A2AAuthError,
    A2AIdentity,
    A2AMessage,
    AgentCard,
    a2a_agent,
    a2a_authenticator,
    a2a_skill,
    authenticate,
    authorize,
    build_agent_card,
    get_registry,
    langstitch_a2a_server,
    load_a2a_server_config,
    load_config,
    select_skills,
)
from langstitch.a2a import get_skill

HAS_HTTPX = importlib.util.find_spec("httpx") is not None
HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None


def _write(tmp_path, body: str):
    (tmp_path / "application.yaml").write_text(body.strip(), encoding="utf-8")


# ── models ──────────────────────────────────────────────────────────────
def test_agent_card_to_dict():
    card = AgentCard(name="Billing", description="Pays bills", url="https://a/", version="1.2")
    d = card.to_dict()
    assert d["name"] == "Billing"
    assert d["protocolVersion"] == "0.2"
    assert d["capabilities"] == {
        "streaming": False,
        "pushNotifications": False,
        "stateTransitionHistory": False,
    }
    assert d["skills"] == []


def test_message_round_trip_and_text():
    raw = {
        "role": "user",
        "parts": [{"kind": "text", "text": "hi"}, {"kind": "text", "text": "there"}],
        "messageId": "m1",
        "metadata": {"skillId": "echo"},
    }
    msg = A2AMessage.from_dict(raw)
    assert msg.text() == "hi\nthere"
    assert msg.message_id == "m1"
    assert msg.to_dict()["kind"] == "message"
    assert msg.to_dict()["metadata"] == {"skillId": "echo"}


# ── decorators / registry ───────────────────────────────────────────────
def test_a2a_server_decorator_registers_spec():
    @langstitch_a2a_server(title="My Agent", port=9200, default_roles=["guest"])
    class MyAgent:
        """My agent."""

    spec = get_registry().a2a_server
    assert spec is not None and spec.title == "My Agent"
    assert spec.port == 9200
    assert spec.default_roles == ["guest"]
    assert MyAgent._langstitch_a2a_server is spec
    assert hasattr(MyAgent, "create_app") and hasattr(MyAgent, "serve")


def test_a2a_skill_and_agent_registration():
    @a2a_skill(skill_id="summarize", roles=["analyst"], tags=["nlp"])
    def summarize(state):
        return "ok"

    a2a_agent("partner", agent_card_url="https://p/.well-known/agent.json", roles=["caller"])

    skills = get_registry().a2a_skills
    assert "summarize" in skills
    assert skills["summarize"].roles == ["analyst"]
    assert get_skill("summarize").skill_id == "summarize"
    assert summarize({"x": 1}) == "ok"  # transparent
    assert get_registry().a2a_agents["partner"].agent_card_url.endswith("agent.json")


# ── auth layer ──────────────────────────────────────────────────────────
def test_load_server_config(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      required: true
      scheme: bearer
      tokens:
        "tok-1":
          subject: billing-agent
          roles: [billing, reader]
    rbac:
      enabled: true
      default_roles: [guest]
""",
    )
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    assert cfg.auth_required is True
    assert cfg.rbac_enabled is True
    assert cfg.default_roles == ["guest"]
    assert cfg.tokens["tok-1"]["roles"] == ["billing", "reader"]


def test_authenticate_with_token_table(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      tokens:
        "tok-1": { subject: billing, roles: [billing] }
""",
    )
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    ident = authenticate({"Authorization": "Bearer tok-1"}, cfg)
    assert ident.authenticated is True
    assert ident.subject == "billing"
    assert ident.roles == ["billing"]


def test_authenticate_required_missing_raises(tmp_path):
    _write(tmp_path, "a2a:\n  server:\n    auth:\n      required: true")
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    with pytest.raises(A2AAuthError) as exc:
        authenticate({}, cfg)
    assert exc.value.status == 401


def test_authenticate_invalid_token_raises(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      required: true
      tokens:
        "good": { subject: s, roles: [r] }
""",
    )
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    with pytest.raises(A2AAuthError):
        authenticate({"Authorization": "Bearer bad"}, cfg)


def test_authenticate_optional_returns_anonymous(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      required: false
    rbac:
      default_roles: [guest]
""",
    )
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    ident = authenticate({}, cfg)
    assert ident.authenticated is False
    assert ident.roles == ["guest"]


def test_api_key_scheme(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      scheme: api_key
      api_key_header: X-API-Key
      tokens:
        "k1": { subject: svc, roles: [svc] }
""",
    )
    load_config(tmp_path)
    cfg = load_a2a_server_config()
    ident = authenticate({"X-API-Key": "k1"}, cfg)
    assert ident.subject == "svc"


def test_custom_authenticator_decorator(tmp_path):
    _write(tmp_path, "a2a:\n  server:\n    auth:\n      required: true")
    load_config(tmp_path)

    @a2a_authenticator
    def verify(headers):
        if headers.get("X-Token") == "letmein":
            return {"subject": "alice", "roles": ["admin"]}
        return None

    cfg = load_a2a_server_config()
    ident = authenticate({"X-Token": "letmein"}, cfg)
    assert ident.subject == "alice"
    assert ident.roles == ["admin"]
    # falls through to token table (and fails) when verifier returns None
    with pytest.raises(A2AAuthError):
        authenticate({"X-Token": "nope"}, cfg)


# ── rbac layer ──────────────────────────────────────────────────────────
def test_authorize_public_skill_allows_anyone():
    @a2a_skill(skill_id="open")
    def open_skill(state):
        return "ok"

    authorize(A2AIdentity.anonymous(), get_skill("open"))  # no raise


def test_authorize_role_required():
    @a2a_skill(skill_id="secure", roles=["admin"])
    def secure(state):
        return "ok"

    skill = get_skill("secure")
    authorize(A2AIdentity(subject="a", roles=["admin"]), skill)  # allowed
    with pytest.raises(A2AAuthError) as exc:
        authorize(A2AIdentity(subject="b", roles=["user"]), skill)
    assert exc.value.status == 403


def test_authorize_unknown_skill_is_404():
    with pytest.raises(A2AAuthError) as exc:
        authorize(A2AIdentity(roles=["admin"]), None)
    assert exc.value.status == 404


def test_authorize_disabled_skill():
    @a2a_skill(skill_id="off", enabled=False)
    def off(state):
        return "ok"

    with pytest.raises(A2AAuthError) as exc:
        authorize(A2AIdentity(), get_skill("off"))
    assert exc.value.status == 404


def test_rbac_disabled_skips_checks():
    @a2a_skill(skill_id="secure", roles=["admin"])
    def secure(state):
        return "ok"

    authorize(A2AIdentity(roles=["user"]), get_skill("secure"), rbac_enabled=False)


def test_select_skills_filters_by_role():
    @a2a_skill(skill_id="pub")
    def pub(state):
        return 1

    @a2a_skill(skill_id="adm", roles=["admin"])
    def adm(state):
        return 1

    visible = {s.skill_id for s in select_skills(A2AIdentity(roles=["user"]))}
    assert visible == {"pub"}
    visible_admin = {s.skill_id for s in select_skills(A2AIdentity(roles=["admin"]))}
    assert visible_admin == {"pub", "adm"}


# ── agent card assembly ─────────────────────────────────────────────────
def test_build_agent_card_advertises_security_and_skills(tmp_path):
    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      required: true
      scheme: bearer
""",
    )
    load_config(tmp_path)

    @langstitch_a2a_server(title="Sec Agent", url="https://sec/")
    class Agent:
        pass

    @a2a_skill(skill_id="ping", roles=["caller"])
    def ping(state):
        return "pong"

    card = build_agent_card()
    d = card.to_dict()
    assert d["url"] == "https://sec/"
    assert d["securitySchemes"]["bearer"] == {"type": "http", "scheme": "bearer"}
    assert d["security"] == [{"bearer": []}]
    # unauthenticated discovery still lists skills
    assert any(s["id"] == "ping" for s in d["skills"])


def test_registry_summary_includes_a2a():
    @langstitch_a2a_server(title="S")
    class S:
        pass

    @a2a_skill(skill_id="t")
    def t(state):
        return 1

    summary = get_registry().summary()
    assert summary["a2a_server"] == "S"
    assert "t" in summary["a2a_skills"]


# ── outbound client (auth layer reuse) ──────────────────────────────────
@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_client_kwargs_reuse_service_auth(tmp_path):
    import httpx

    from langstitch.a2a_client import _client_kwargs

    _write(
        tmp_path,
        """
external_services:
  partner_a2a:
    serverUrl: https://partner.example.com
    auth:
      type: bearer
      token: svc-token
""",
    )
    load_config(tmp_path)
    kwargs = _client_kwargs(
        service="partner_a2a",
        agent_card_url="",
        token=None,
        auth_env=None,
        request_headers=None,
        overrides={},
        httpx=httpx,
    )
    assert kwargs["headers"]["Authorization"] == "Bearer svc-token"
    assert kwargs["base_url"] == "https://partner.example.com"


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_client_kwargs_env_bearer():
    import httpx

    from langstitch.a2a_client import _client_kwargs

    import os

    os.environ["A2A_API_KEY"] = "env-secret"
    try:
        kwargs = _client_kwargs(
            service="",
            agent_card_url="https://x.example.com/.well-known/agent.json",
            token=None,
            auth_env="A2A_API_KEY",
            request_headers=None,
            overrides={},
            httpx=httpx,
        )
    finally:
        del os.environ["A2A_API_KEY"]
    assert kwargs["headers"]["Authorization"] == "Bearer env-secret"
    assert kwargs["base_url"] == "https://x.example.com"


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_send_message_round_trip():
    import httpx

    from langstitch.a2a_client import A2AClient

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["json"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "result": {"role": "agent", "parts": [{"kind": "text", "text": "pong"}]},
            },
        )

    transport = httpx.MockTransport(handler)
    client = A2AClient(httpx.Client(transport=transport, base_url="https://x"))
    result = client.send_message("ping", skill_id="echo")
    assert result["parts"][0]["text"] == "pong"
    assert "message/send" in captured["json"]
    assert "skillId" in captured["json"]
    client.close()


# ── inbound server (auth + rbac end to end) ─────────────────────────────
@pytest.mark.skipif(not (HAS_FASTAPI and HAS_HTTPX), reason="fastapi/httpx not installed")
def test_server_enforces_auth_and_rbac(tmp_path):
    from fastapi.testclient import TestClient

    from langstitch.a2a_server import create_a2a_app

    _write(
        tmp_path,
        """
a2a:
  server:
    auth:
      required: true
      scheme: bearer
      tokens:
        "admin-tok": { subject: admin, roles: [admin] }
        "user-tok": { subject: user, roles: [user] }
    rbac:
      enabled: true
""",
    )
    load_config(tmp_path)

    @langstitch_a2a_server(title="Guarded", url="https://g/")
    class Guarded:
        pass

    @a2a_skill(skill_id="secure", roles=["admin"])
    def secure(state):
        return {"output": f"hello {state['a2a_identity']['subject']}"}

    app = create_a2a_app()
    client = TestClient(app)

    rpc = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "message/send",
        "params": {"message": {"role": "user", "parts": [{"kind": "text", "text": "hi"}],
                               "metadata": {"skillId": "secure"}}},
    }

    # no auth -> 401
    assert client.post("/", json=rpc).status_code == 401

    # wrong role -> 403
    r_user = client.post("/", json=rpc, headers={"Authorization": "Bearer user-tok"})
    assert r_user.status_code == 403

    # correct role -> 200 with result
    r_admin = client.post("/", json=rpc, headers={"Authorization": "Bearer admin-tok"})
    assert r_admin.status_code == 200
    parts = r_admin.json()["result"]["parts"]
    assert any(p.get("text") == "hello admin" for p in parts)

    # agent card discovery is open
    card = client.get("/.well-known/agent.json")
    assert card.status_code == 200
    assert card.json()["url"] == "https://g/"
