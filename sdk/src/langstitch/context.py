"""Hierarchical context management.

The contract: every LLM call or sub-agent call runs inside a *temporary child
context*. The child can accumulate as much detail as it needs (tool-call
messages, scratch reasoning, retrieved chunks) without ever touching the parent.
When the call finishes, **only the final output** is merged back into the parent
context — so parents stay clean and small no matter how deep the tree goes.

    ctx = Context(data={"question": "..."})

    def call_model(llm_ctx):
        # llm_ctx.tools were materialized lazily & injected just for this call
        return model.invoke(llm_ctx.messages, tools=llm_ctx.tools)

    answer = run_llm(ctx, call_model, tool_tags=["search"], key="answer")
    # ctx.data["answer"] is set; intermediate tool traffic was discarded.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from .registries import (
    AgentRegistry,
    ToolRegistry,
    get_agent_registry,
    get_input_guardrails,
    get_output_guardrails,
    get_tool_registry,
)
from .registry import ToolSpec, get_registry

__all__ = [
    "Context",
    "ContextScope",
    "ContextBuilder",
    "LLMContext",
    "run_llm",
    "run_worker_agent",
]


@dataclass
class Context:
    """A node in the context hierarchy.

    * ``data`` — durable, parent-visible facts (the only thing merged upward).
    * ``scratch`` — ephemeral working memory, discarded when the scope ends.
    * ``messages`` — conversation visible *at this level only*.
    """

    data: Dict[str, Any] = field(default_factory=dict)
    scratch: Dict[str, Any] = field(default_factory=dict)
    messages: List[Any] = field(default_factory=list)
    parent: Optional["Context"] = None
    depth: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def root(self) -> "Context":
        node = self
        while node.parent is not None:
            node = node.parent
        return node

    def child(
        self,
        *,
        carry: Iterable[str] = (),
        messages: Optional[Sequence[Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "Context":
        """Create an isolated temporary child context.

        Only ``carry`` keys are copied down from the parent's ``data``; scratch
        and messages start fresh so nothing leaks back up by accident.
        """
        carried = {k: self.data[k] for k in carry if k in self.data}
        return Context(
            data=carried,
            messages=list(messages) if messages is not None else [],
            parent=self,
            depth=self.depth + 1,
            metadata={**self.metadata, **(metadata or {})},
        )

    def scope(
        self,
        *,
        carry: Iterable[str] = (),
        messages: Optional[Sequence[Any]] = None,
        key: str = "result",
        summarize: Optional[Callable[[Any], Any]] = None,
        as_message: Optional[str] = None,
    ) -> "ContextScope":
        return ContextScope(
            self, carry=carry, messages=messages, key=key,
            summarize=summarize, as_message=as_message,
        )


class ContextScope:
    """Context manager wrapping a temporary child context.

    On exit, if a value was committed and no exception occurred, *only* that
    value is written back to the parent. The child (scratch + messages) is
    dropped, guaranteeing the parent context is never polluted with the call's
    internal detail.
    """

    def __init__(
        self,
        parent: Context,
        *,
        carry: Iterable[str] = (),
        messages: Optional[Sequence[Any]] = None,
        key: str = "result",
        summarize: Optional[Callable[[Any], Any]] = None,
        as_message: Optional[str] = None,
    ) -> None:
        self.parent = parent
        self._carry = carry
        self._messages = messages
        self.key = key
        self.summarize = summarize
        self.as_message = as_message
        self.child: Optional[Context] = None
        self.output: Any = None
        self._committed = False
        self._value: Any = None

    def __enter__(self) -> Context:
        self.child = self.parent.child(carry=self._carry, messages=self._messages)
        return self.child

    def commit(self, value: Any, *, key: Optional[str] = None) -> Any:
        self._value = value
        self._committed = True
        if key is not None:
            self.key = key
        return value

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None and self._committed:
            out = self.summarize(self._value) if self.summarize else self._value
            self.output = out
            self.parent.data[self.key] = out
            if self.as_message:
                content = out if isinstance(out, str) else repr(out)
                self.parent.messages.append({"role": self.as_message, "content": content})
        # child is discarded either way -> no pollution
        self.child = None
        return False  # never suppress exceptions


@dataclass
class LLMContext:
    """The package of information injected into a single LLM call."""

    system: str = ""
    messages: List[Any] = field(default_factory=list)
    tools: List[Any] = field(default_factory=list)           # materialized
    tool_specs: List[ToolSpec] = field(default_factory=list)  # selected specs
    input_guardrails: List[Any] = field(default_factory=list)
    output_guardrails: List[Any] = field(default_factory=list)
    persona: Optional[str] = None
    context: Optional[Context] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


def _resolve_persona(name: Optional[str]) -> str:
    if not name:
        return ""
    spec = get_registry().personas.get(name)
    if spec is None:
        return ""
    target = spec.target
    try:
        result = target() if callable(target) else target
        return result if isinstance(result, str) else (spec.description or "")
    except Exception:  # pragma: no cover - persona builders should be cheap
        return spec.description or ""


class ContextBuilder:
    """Pulls the right tools/guardrails/persona for a single LLM decision.

    Selection is lazy: only the requested subset is materialized, so a node that
    needs two search tools never instantiates the whole tool catalogue.
    """

    def __init__(
        self,
        tool_registry: Optional[ToolRegistry] = None,
        agent_registry: Optional[AgentRegistry] = None,
    ) -> None:
        self.tools = tool_registry or get_tool_registry()
        self.agents = agent_registry or get_agent_registry()

    def build(
        self,
        ctx: Context,
        *,
        persona: Optional[str] = None,
        tool_names: Optional[Sequence[str]] = None,
        tool_tags: Optional[Sequence[str]] = None,
        roles: Optional[Sequence[str]] = None,
        include_guardrails: bool = True,
        system: Optional[str] = None,
        messages: Optional[Sequence[Any]] = None,
        agent: Optional[str] = None,
    ) -> LLMContext:
        # A worker agent constrains the available tools + persona.
        if agent:
            spec = self.agents.get(agent)
            if spec is not None:
                if tool_names is None and spec.tools:
                    tool_names = spec.tools
                if persona is None and spec.persona:
                    persona = spec.persona

        selected = self.tools.select(names=tool_names, tags=tool_tags, roles=roles)
        materialized = self.tools.bind(selected)
        sys_prompt = system if system is not None else _resolve_persona(persona)

        return LLMContext(
            system=sys_prompt,
            messages=list(messages) if messages is not None else list(ctx.messages),
            tools=materialized,
            tool_specs=selected,
            input_guardrails=get_input_guardrails() if include_guardrails else [],
            output_guardrails=get_output_guardrails() if include_guardrails else [],
            persona=persona,
            context=ctx,
            metadata={"depth": ctx.depth, "agent": agent},
        )


def run_llm(
    ctx: Context,
    invoke: Callable[[LLMContext], Any],
    *,
    persona: Optional[str] = None,
    tool_names: Optional[Sequence[str]] = None,
    tool_tags: Optional[Sequence[str]] = None,
    roles: Optional[Sequence[str]] = None,
    include_guardrails: bool = True,
    system: Optional[str] = None,
    messages: Optional[Sequence[Any]] = None,
    carry: Iterable[str] = (),
    key: str = "result",
    summarize: Optional[Callable[[Any], Any]] = None,
    as_message: Optional[str] = None,
    builder: Optional[ContextBuilder] = None,
) -> Any:
    """Run an LLM call in an isolated child context; merge only its output up.

    ``invoke`` receives a fully-built :class:`LLMContext` (tools already
    materialized + injected) and returns the model output. That output is the
    *only* thing written back to ``ctx`` (under ``key``).
    """
    builder = builder or ContextBuilder()
    scope = ctx.scope(carry=carry, messages=messages, key=key, summarize=summarize, as_message=as_message)
    with scope as child:
        llm_ctx = builder.build(
            child, persona=persona, tool_names=tool_names, tool_tags=tool_tags,
            roles=roles, include_guardrails=include_guardrails, system=system,
            messages=messages,
        )
        scope.commit(invoke(llm_ctx))
    return scope.output


def run_worker_agent(
    ctx: Context,
    name: str,
    invoke: Optional[Callable[[LLMContext], Any]] = None,
    *,
    carry: Iterable[str] = (),
    key: Optional[str] = None,
    summarize: Optional[Callable[[Any], Any]] = None,
    as_message: Optional[str] = None,
    builder: Optional[ContextBuilder] = None,
    **invoke_kwargs: Any,
) -> Any:
    """Delegate to a registered worker agent inside an isolated child context.

    The sub-agent runs with only its allowed tools/persona. If ``invoke`` is
    omitted, the agent's own target callable is invoked with the child context.
    Only the agent's final output is merged back into ``ctx``.
    """
    builder = builder or ContextBuilder()
    agents = builder.agents
    spec = agents.get(name)
    if spec is None:
        raise KeyError(f"unknown worker_agent: {name!r}")
    result_key = key or name

    scope = ctx.scope(carry=carry, key=result_key, summarize=summarize, as_message=as_message)
    with scope as child:
        llm_ctx = builder.build(child, agent=name)
        if invoke is not None:
            result = invoke(llm_ctx)
        else:
            target = spec.target
            result = target(llm_ctx, **invoke_kwargs) if callable(target) else target
        scope.commit(result)
    return scope.output
