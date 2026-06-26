"""Hierarchical context: isolation + only-output-merges-up guarantees."""
from langstitch import (
    Context,
    ContextBuilder,
    persona,
    run_llm,
    run_worker_agent,
    tool,
    worker_agent,
)


def test_child_isolation():
    parent = Context(data={"a": 1, "b": 2}, messages=[{"role": "user", "content": "hi"}])
    child = parent.child(carry=["a"])
    assert child.data == {"a": 1}  # only carried key
    assert child.messages == []  # fresh
    assert child.depth == 1 and child.parent is parent

    # mutating the child must not touch the parent
    child.data["a"] = 999
    child.scratch["tmp"] = "x"
    child.messages.append("noise")
    assert parent.data["a"] == 1
    assert "tmp" not in parent.scratch
    assert parent.messages == [{"role": "user", "content": "hi"}]


def test_scope_only_merges_committed_output():
    parent = Context(data={"q": "?"})

    # Not committed -> nothing leaks up.
    scope = parent.scope(key="answer")
    with scope as child:
        child.scratch["internal"] = "lots of detail"
        child.messages.append({"role": "tool", "content": "tool noise"})
    assert "answer" not in parent.data

    # Committed -> only the (summarized) output reaches the parent.
    scope = parent.scope(key="answer", summarize=lambda v: v.upper())
    with scope as child:
        child.scratch["internal"] = "detail"
        scope.commit("done")
    assert parent.data["answer"] == "DONE"
    assert "internal" not in parent.scratch
    assert scope.output == "DONE"


def test_run_llm_injects_selected_tools_and_merges_only_output():
    @tool(tags=["search"])
    def s(q):
        return q

    @tool(tags=["math"])
    def m(a):
        return a

    @persona(role="assistant")
    def assistant():
        return "be helpful"

    parent = Context(
        data={"keep": "me"},
        messages=[{"role": "user", "content": "hello"}],
    )

    captured = {}

    def invoke(llm_ctx):
        captured["tools"] = {t.name for t in llm_ctx.tool_specs}
        captured["system"] = llm_ctx.system
        captured["depth"] = llm_ctx.context.depth
        # add internal noise that must NOT reach the parent
        llm_ctx.context.scratch["scratchpad"] = "secret reasoning"
        llm_ctx.context.messages.append({"role": "tool", "content": "tool call"})
        return "final answer"

    out = run_llm(
        parent, invoke, persona="assistant", tool_tags=["search"],
        key="answer", as_message="assistant",
    )

    assert out == "final answer"
    assert captured["tools"] == {"s"}  # only the search tool injected
    assert captured["system"] == "be helpful"
    assert captured["depth"] == 1
    # parent gets ONLY the output (under key + one compact message)
    assert parent.data["answer"] == "final answer"
    assert parent.data["keep"] == "me"
    assert "scratchpad" not in parent.scratch
    assert parent.messages[-1] == {"role": "assistant", "content": "final answer"}
    assert not any(msg.get("content") == "tool call" for msg in parent.messages)


def test_run_worker_agent_scopes_tools_and_isolates():
    @tool(name="allowed")
    def allowed():
        return "ok"

    @tool(name="forbidden")
    def forbidden():
        return "no"

    @worker_agent(name="w", tools=["allowed"], persona=None)
    def w(llm_ctx):
        # agent sees only its allowed tools
        assert {t.name for t in llm_ctx.tool_specs} == {"allowed"}
        llm_ctx.context.scratch["x"] = "internal"
        return "agent result"

    parent = Context(data={"task": "do it"})
    out = run_worker_agent(parent, "w", carry=["task"])
    assert out == "agent result"
    assert parent.data["w"] == "agent result"
    assert "x" not in parent.scratch  # isolation preserved


def test_context_builder_direct():
    @tool(tags=["t"])
    def a():
        return 1

    ctx = Context()
    built = ContextBuilder().build(ctx, tool_tags=["t"])
    assert {t.name for t in built.tool_specs} == {"a"}
    assert built.tools and callable(built.tools[0])
