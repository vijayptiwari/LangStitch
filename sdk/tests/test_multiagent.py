"""Multi-agent decorators: unified @agent/run_agent, supervisor, handoff."""
import importlib.util

import pytest

from langstitch import (
    AgentDelegationError,
    agent,
    get_registry,
    get_supervisor,
    load_config,
    make_handoff_tool,
    remote_agent,
    run_agent,
    supervisor,
    worker_agent,
)
from langstitch.orchestration import invoke_remote_agent

HAS_HTTPX = importlib.util.find_spec("httpx") is not None
HAS_LANGGRAPH = importlib.util.find_spec("langgraph") is not None


def _write(tmp_path, body: str):
    (tmp_path / "application.yaml").write_text(body.strip(), encoding="utf-8")


# ── unified @agent registration ─────────────────────────────────────────
def test_agent_local_decorator():
    @agent(tools=["web"], roles=["analyst"])
    def researcher(state):
        return {"answer": "42"}

    spec = get_registry().worker_agents["researcher"]
    assert spec.transport == "local"
    assert spec.roles == ["analyst"]
    assert spec.tools == ["web"]
    assert researcher({}) == {"answer": "42"}  # transparent


def test_agent_bare_decorator():
    @agent
    def helper(state):
        return state

    assert "helper" in get_registry().worker_agents
    assert get_registry().worker_agents["helper"].transport == "local"


def test_remote_and_a2a_registration():
    agent(name="legal", transport="remote", url="https://legal/invoke", service="legal_svc",
          roles=["counsel"])
    remote_agent("orders", url="https://orders/invoke", auth_env="ORDERS_TOKEN")
    agent(name="billing", transport="a2a",
          url="https://billing/.well-known/agent.json", service="billing_a2a")

    reg = get_registry().worker_agents
    assert reg["legal"].transport == "remote" and reg["legal"].roles == ["counsel"]
    assert reg["orders"].transport == "remote" and reg["orders"].auth_env == "ORDERS_TOKEN"
    assert reg["billing"].transport == "a2a"


def test_remote_agent_requires_name():
    with pytest.raises(ValueError, match="requires an explicit name"):
        agent(transport="remote", url="https://x")


# ── run_agent dispatch + RBAC ───────────────────────────────────────────
def test_run_agent_local():
    @agent
    def echo(state):
        return {"echo": state["input"]}

    assert run_agent({"input": "hi"}, "echo") == {"echo": "hi"}


def test_run_agent_unknown():
    with pytest.raises(AgentDelegationError) as exc:
        run_agent({}, "nope")
    assert exc.value.status == 404


def test_run_agent_rbac_denied_and_allowed():
    @agent(roles=["admin"])
    def secure(state):
        return "ok"

    assert run_agent({}, "secure", caller_roles=["admin"]) == "ok"
    with pytest.raises(AgentDelegationError) as exc:
        run_agent({}, "secure", caller_roles=["user"])
    assert exc.value.status == 403
    # no caller_roles -> RBAC skipped
    assert run_agent({}, "secure") == "ok"


def test_run_agent_disabled():
    @agent(enabled=False)
    def off(state):
        return "x"

    with pytest.raises(AgentDelegationError):
        run_agent({}, "off")


# ── remote transport over the services auth layer ───────────────────────
@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_invoke_remote_agent_uses_service_auth(tmp_path, monkeypatch):
    import httpx

    _write(
        tmp_path,
        """
external_services:
  legal_svc:
    serverUrl: https://legal.example.com
    auth:
      type: bearer
      token: svc-tok
""",
    )
    load_config(tmp_path)
    agent(name="legal", transport="remote", url="/invoke", service="legal_svc")
    spec = get_registry().worker_agents["legal"]

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        captured["url"] = str(request.url)
        captured["body"] = request.read().decode()
        return httpx.Response(200, json={"result": {"verdict": "ok"}})

    # Patch httpx.Client to use a mock transport
    real_client = httpx.Client

    def patched_client(**kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(**kwargs)

    monkeypatch.setattr(httpx, "Client", patched_client)
    result = invoke_remote_agent(spec, {"case": 1})
    assert result == {"verdict": "ok"}
    assert captured["auth"] == "Bearer svc-tok"
    assert captured["url"].endswith("/invoke")
    assert '"state"' in captured["body"]


@pytest.mark.skipif(not HAS_HTTPX, reason="httpx not installed")
def test_run_agent_remote_dispatch(tmp_path, monkeypatch):
    import httpx

    _write(tmp_path, "app:\n  name: t")
    load_config(tmp_path)
    monkeypatch.setenv("ORD_TOKEN", "env-tok")
    remote_agent("orders", url="https://orders.example.com/invoke", auth_env="ORD_TOKEN")

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"result": {"ok": True}})

    real_client = httpx.Client

    def patched_client(**kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(**kwargs)

    monkeypatch.setattr(httpx, "Client", patched_client)
    assert run_agent({"order": 7}, "orders") == {"ok": True}
    assert captured["auth"] == "Bearer env-tok"


def test_run_agent_a2a_dispatch(monkeypatch):
    agent(
        name="research",
        transport="a2a",
        url="https://research.example.com/.well-known/agent.json",
        auth_env="A2A_TOKEN",
    )
    captured = {}

    def fake_invoke(message, **kwargs):
        captured["message"] = message
        captured["kwargs"] = kwargs
        return {"answer": "done"}

    import importlib

    a2a_client = importlib.import_module("langstitch.a2a_client")

    monkeypatch.setattr(a2a_client, "invoke_a2a_agent", fake_invoke)

    result = run_agent({"input": "research this"}, "research", skill_id="summary")

    assert result == {"answer": "done"}
    assert captured["message"] == {"input": "research this"}
    assert captured["kwargs"]["agent_card_url"] == "https://research.example.com/.well-known/agent.json"
    assert captured["kwargs"]["auth_env"] == "A2A_TOKEN"
    assert captured["kwargs"]["skill_id"] == "summary"


# ── supervisor pattern ──────────────────────────────────────────────────
def test_supervisor_custom_router_choice():
    @agent
    def researcher(state):
        return state

    @agent
    def writer(state):
        return state

    @supervisor(agents=["researcher", "writer"], router="custom")
    def triage(state):
        return "writer" if state.get("draft") else "researcher"

    spec = get_registry().supervisors["triage"]
    assert spec.members == ["researcher", "writer"]
    sup = get_supervisor("triage")
    assert sup.choose({"draft": False}) == "researcher"
    assert sup.choose({"draft": True}) == "writer"


def test_supervisor_invalid_choice_falls_back_to_finish():
    @supervisor(name="s", agents=["a"], router="custom")
    def route(state):
        return "does-not-exist"

    assert get_supervisor("s").choose({}) == "__end__"


def test_supervisor_llm_registration_without_callable():
    supervisor(name="boss", agents=["a", "b"], instructions="route well")
    spec = get_registry().supervisors["boss"]
    assert spec.router == "llm"
    assert spec.members == ["a", "b"]


def test_supervisor_choose_with_injected_chooser():
    supervisor(name="boss", agents=["a", "b"])
    sup = get_supervisor("boss")
    assert sup.choose({}, chooser=lambda s: "b") == "b"


def test_registry_summary_includes_supervisors():
    @supervisor(name="s", agents=["a"], router="custom")
    def r(state):
        return "a"

    assert "s" in get_registry().summary()["supervisors"]


# ── handoff (swarm) ─────────────────────────────────────────────────────
def test_make_handoff_tool_metadata():
    t = make_handoff_tool("billing")
    assert t.__name__ == "transfer_to_billing"
    assert "billing" in t.__doc__


@pytest.mark.skipif(HAS_LANGGRAPH, reason="only when langgraph is absent")
def test_handoff_without_langgraph_raises():
    from langstitch import handoff

    with pytest.raises(RuntimeError, match="LangGraph"):
        handoff("billing")


@pytest.mark.skipif(not HAS_LANGGRAPH, reason="langgraph not installed")
def test_handoff_returns_command():
    from langstitch import handoff

    cmd = handoff("billing", update={"reason": "refund"})
    assert getattr(cmd, "goto", None) == "billing"
