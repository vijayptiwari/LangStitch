"""Dynamic Tool/Agent registries: lazy refresh, selection, materialization."""
from langstitch import (
    get_agent_registry,
    get_all_tools,
    get_all_worker_agents,
    get_input_guardrails,
    get_output_guardrails,
    get_tool_registry,
    input_guardrail,
    output_guardrail,
    tool,
    worker_agent,
)


def test_tool_registry_auto_refresh_on_change():
    reg = get_tool_registry()
    assert reg.all() == []  # nothing registered yet (clean registry per test)

    @tool(tags=["search"], roles=["user"])
    def alpha(q):
        return q

    # Registry auto-detects the new registration (revision bumped) — no manual refresh.
    assert "alpha" in reg.names()

    @tool(tags=["math"])
    def beta(a, b):
        return a + b

    assert {"alpha", "beta"} <= set(reg.names())


def test_tool_selection_by_tag_role_name():
    @tool(tags=["search"], roles=["admin"])
    def s(q):
        return q

    @tool(tags=["math"])
    def m(a):
        return a

    reg = get_tool_registry()
    assert {t.name for t in reg.select(tags=["search"])} == {"s"}
    assert {t.name for t in reg.select(names=["m"])} == {"m"}
    # role-gated: admin-only tool excluded for a 'user' role; unrestricted 'm' included
    selected = {t.name for t in reg.select(roles=["user"])}
    assert "s" not in selected and "m" in selected


def test_tool_materialization_is_lazy_and_cached():
    @tool
    def t():
        return 42

    reg = get_tool_registry()
    fn = reg.materialize("t")
    assert callable(fn) and fn() == 42
    assert reg.materialize("t") is fn  # cached within a refresh


def test_agent_registry_and_guardrail_accessors():
    @worker_agent(role="researcher", tools=["x"])
    def researcher(ctx):
        return "done"

    @input_guardrail
    def gi(text):
        return True

    @output_guardrail
    def go(text):
        return True

    assert any(a.name == "researcher" for a in get_all_worker_agents())
    assert get_agent_registry().get("researcher").tools == ["x"]
    assert {g.name for g in get_input_guardrails()} == {"gi"}
    assert {g.name for g in get_output_guardrails()} == {"go"}
    assert get_all_tools() == []  # tools and agents are separate catalogues
