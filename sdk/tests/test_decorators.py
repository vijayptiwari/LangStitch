"""Decorators register specs in both bare and parameterized forms."""
from langstitch import (
    business_policy,
    get_registry,
    graph,
    graph_node,
    input_guardrail,
    output_guardrail,
    persona,
    skill,
)
from langstitch.graph import GraphBuilder


def test_graph_node_bare_and_named():
    @graph_node
    def alpha(state):
        return {}

    @graph_node(name="beta_node", tags=["x"])
    def beta(state):
        return {}

    reg = get_registry()
    assert "alpha" in reg.nodes
    assert "beta_node" in reg.nodes
    assert reg.nodes["beta_node"].tags == ["x"]
    # decorator is transparent
    assert alpha({}) == {}


def test_skill_registers_metadata():
    @skill(tools=["web"], tags=["retrieval"], persona="assistant")
    def search(q):
        return [q]

    spec = get_registry().skills["search"]
    assert spec.tools == ["web"]
    assert spec.persona == "assistant"
    assert search("hi") == ["hi"]


def test_guardrails_split_by_stage():
    @input_guardrail
    def gin(text):
        return True

    @output_guardrail(action="warn", severity="low")
    def gout(text):
        return True

    reg = get_registry()
    assert "gin" in reg.input_guardrails
    assert "gout" in reg.output_guardrails
    assert reg.output_guardrails["gout"].action == "warn"


def test_policy_and_persona():
    @business_policy(priority=5)
    def allow(ctx):
        return {"decision": "allow"}

    @persona(role="assistant", tone="warm")
    def helper():
        return "be nice"

    reg = get_registry()
    assert reg.policies["allow"].priority == 5
    assert reg.personas["helper"].role == "assistant"


def test_graph_entrypoint_resolution():
    @graph(name="sub", parent="main")
    def sub():
        return GraphBuilder("sub")

    @graph(name="main", entrypoint=True)
    def main():
        return GraphBuilder("main")

    reg = get_registry()
    assert reg.entrypoint_graph().name == "main"
