"""Multi-agent orchestration — uniform delegation, supervisors, and handoffs.

This ties the agent primitives together over the existing auth + RBAC layers:

* :func:`run_agent` — delegate to any registered agent (``local`` / ``remote`` /
  ``a2a``) through one call. RBAC roles on the :class:`~langstitch.registry.AgentSpec`
  gate who may delegate; remote/A2A auth reuses the SDK services layer.
* :func:`invoke_remote_agent` — call a remote graph ``/invoke`` endpoint with
  credentials resolved from ``external_services`` (or an env bearer token).
* ``@supervisor`` + :class:`Supervisor` — the supervisor pattern: a router that
  delegates to member agents and routes with LangGraph ``Command(goto=...)``.
* :func:`handoff` / :func:`make_handoff_tool` — the swarm pattern: peer-to-peer
  transfer of control via ``Command``.

LangGraph is imported lazily inside the routing runtime (``handoff`` /
``Supervisor.route`` / ``build``) and raises a helpful error if missing, so the
decorators and routing *decisions* stay usable without the ``graph`` extra.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional, Sequence

from ._decorators import resolve_description, resolve_name
from .registry import AgentSpec, SupervisorSpec, get_registry

__all__ = [
    "AgentDelegationError",
    "run_agent",
    "invoke_remote_agent",
    "supervisor",
    "Supervisor",
    "get_supervisor",
    "handoff",
    "make_handoff_tool",
]


class AgentDelegationError(Exception):
    """Raised when delegation is denied by RBAC or the agent is unknown."""

    def __init__(self, message: str, *, status: int = 403) -> None:
        super().__init__(message)
        self.status = status


# ──────────────────────────────────────────────────────────────────────────
# RBAC for delegation (same empty-list-means-open convention as tools/A2A)
# ──────────────────────────────────────────────────────────────────────────
def _authorize_delegation(spec: AgentSpec, caller_roles: Optional[Sequence[str]]) -> None:
    required = set(getattr(spec, "roles", []) or [])
    if not required or caller_roles is None:
        return
    if not (set(caller_roles) & required):
        raise AgentDelegationError(
            f"role(s) {sorted(required)} required to delegate to agent {spec.name!r}",
            status=403,
        )


def _require_httpx() -> Any:
    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "Remote agent calls require httpx. Install it with:\n"
            "    pip install 'langstitch[http]'"
        ) from exc
    return httpx


def _require_command() -> Any:
    try:
        from langgraph.types import Command
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "Handoffs / supervisor routing require LangGraph. Install it with:\n"
            "    pip install 'langstitch[graph]'"
        ) from exc
    return Command


# ──────────────────────────────────────────────────────────────────────────
# Remote graph client (reuses the services auth layer)
# ──────────────────────────────────────────────────────────────────────────
def invoke_remote_agent(
    spec: AgentSpec,
    payload: Any,
    *,
    request_headers: Optional[Dict[str, str]] = None,
) -> Any:
    """Call a remote graph ``/invoke`` endpoint described by ``spec``.

    Body shape and result extraction are configurable via ``spec.metadata``
    (``body_key`` default ``"state"``, ``result_key`` default ``"result"``) to
    match the LangStitch graph server contract.
    """
    httpx = _require_httpx()
    body_key = str(spec.metadata.get("body_key", "state"))
    result_key = str(spec.metadata.get("result_key", "result"))
    body = {body_key: payload}

    if spec.service:
        from .services import build_service_client_kwargs, load_service_config

        svc = load_service_config(spec.service)
        kwargs = build_service_client_kwargs(svc, httpx, request_headers=request_headers)
        path = spec.url or "/invoke"
        with httpx.Client(**kwargs) as client:
            resp = client.post(path, json=body)
            resp.raise_for_status()
            data = resp.json()
    else:
        if not spec.url:
            raise AgentDelegationError(
                f"remote agent {spec.name!r} has no url or service configured", status=400
            )
        headers: Dict[str, str] = dict(request_headers or {})
        token = os.environ.get(spec.auth_env) if spec.auth_env else None
        if token:
            headers["Authorization"] = f"Bearer {token}"
        with httpx.Client() as client:
            resp = client.post(spec.url, json=body, headers=headers or None)
            resp.raise_for_status()
            data = resp.json()

    if isinstance(data, dict) and result_key in data:
        return data[result_key]
    return data


# ──────────────────────────────────────────────────────────────────────────
# Unified delegation
# ──────────────────────────────────────────────────────────────────────────
def run_agent(
    payload: Any,
    name: str,
    *,
    ctx: Any = None,
    caller_roles: Optional[Sequence[str]] = None,
    skill_id: str = "",
    request_headers: Optional[Dict[str, str]] = None,
    **kwargs: Any,
) -> Any:
    """Delegate ``payload`` to the registered agent ``name`` (any transport).

    Dispatch by ``spec.transport``:

    * ``local``  — invoke the agent's callable. When a :class:`~langstitch.Context`
      is passed via ``ctx``, delegation runs in an isolated child context (see
      :func:`langstitch.run_worker_agent`); otherwise the target is called with
      ``payload`` directly.
    * ``remote`` — :func:`invoke_remote_agent`.
    * ``a2a``    — :func:`langstitch.a2a_client.invoke_a2a_agent`.

    ``caller_roles`` enables the RBAC check against ``spec.roles`` (skipped when
    ``None``). Raises :class:`AgentDelegationError` when unknown or denied.
    """
    spec = get_registry().worker_agents.get(name)
    if spec is None:
        raise AgentDelegationError(f"unknown agent: {name!r}", status=404)
    if not spec.enabled:
        raise AgentDelegationError(f"agent {name!r} is disabled", status=404)

    _authorize_delegation(spec, caller_roles)

    transport = spec.transport or "local"

    if transport == "local":
        if ctx is not None:
            from .context import run_worker_agent

            return run_worker_agent(ctx, name, **kwargs)
        if not callable(spec.target):
            raise AgentDelegationError(
                f"local agent {name!r} has no callable target", status=500
            )
        return spec.target(payload, **kwargs)

    if transport == "remote":
        return invoke_remote_agent(spec, payload, request_headers=request_headers)

    if transport == "a2a":
        from .a2a_client import invoke_a2a_agent

        return invoke_a2a_agent(
            payload,
            agent_card_url=spec.url,
            service=spec.service,
            auth_env=spec.auth_env or None,
            skill_id=skill_id,
            request_headers=request_headers,
        )

    raise AgentDelegationError(f"unsupported agent transport: {transport!r}", status=400)


# ──────────────────────────────────────────────────────────────────────────
# Supervisor pattern
# ──────────────────────────────────────────────────────────────────────────
class Supervisor:
    """Runtime for a registered :class:`SupervisorSpec`.

    ``choose`` returns the next member name (or ``finish``) — pure and testable.
    ``route`` wraps that decision in a LangGraph ``Command``. ``build`` wires a
    :class:`~langstitch.GraphBuilder` of supervisor + member nodes.
    """

    def __init__(self, spec: SupervisorSpec) -> None:
        self.spec = spec

    @property
    def targets(self) -> List[str]:
        return [*self.spec.members, self.spec.finish]

    def choose(self, state: Any, *, chooser: Optional[Callable[[Any], str]] = None) -> str:
        """Decide the next destination among members + ``finish``."""
        if chooser is not None:
            return self._validate(chooser(state))
        if self.spec.router == "custom":
            if not callable(self.spec.target):
                raise RuntimeError(
                    f"supervisor {self.spec.name!r} uses router='custom' but has no callable"
                )
            return self._validate(self.spec.target(state))
        return self._validate(self._llm_choose(state))

    def _validate(self, choice: Any) -> str:
        choice = str(choice).strip()
        if choice in self.targets:
            return choice
        # tolerate END aliases / casing
        for target in self.targets:
            if choice.lower() == target.lower():
                return target
        return self.spec.finish

    def _llm_choose(self, state: Any) -> str:
        from .providers import get_llm_provider

        llm = get_llm_provider(self.spec.model or None)
        members = ", ".join(self.spec.members) or "(none)"
        system = (
            self.spec.instructions
            or "You are a supervisor routing a task to the best specialist agent."
        )
        prompt = (
            f"{system}\n\n"
            f"Available agents: {members}.\n"
            f"Reply with ONLY one agent name, or '{self.spec.finish}' when the task is complete.\n\n"
            f"Current task/state:\n{_state_text(state)}\n"
        )
        result = llm.invoke(prompt)
        return getattr(result, "content", result)

    def route(self, state: Any, *, update: Optional[Dict[str, Any]] = None) -> Any:
        """Return a ``Command(goto=<choice>)`` (requires LangGraph)."""
        Command = _require_command()
        choice = self.choose(state)
        kwargs: Dict[str, Any] = {"goto": choice}
        if update is not None:
            kwargs["update"] = update
        return Command(**kwargs)

    def build(self, *, state_schema: Any = dict) -> Any:
        """Wire a :class:`~langstitch.GraphBuilder` for this supervisor team.

        ``START -> supervisor``; the supervisor routes to a member (or ``finish``)
        via ``Command``; each member returns to the supervisor.
        """
        from .graph import END, START, GraphBuilder

        reg = get_registry()
        builder = GraphBuilder(self.spec.name, state_schema)

        def _supervisor_node(state: Any) -> Any:
            return self.route(state)

        builder.add_node(self.spec.name, _supervisor_node)
        builder.set_entry_point(self.spec.name)

        for member in self.spec.members:
            spec = reg.worker_agents.get(member)
            if spec is None:
                raise KeyError(f"supervisor {self.spec.name!r}: unknown member {member!r}")
            handler = _member_handler(spec)
            builder.add_node(member, handler)
            builder.add_edge(member, self.spec.name)

        finish = self.spec.finish
        if finish not in (END, "__end__"):
            builder.add_edge(self.spec.name, finish)
        return builder


def _member_handler(spec: AgentSpec) -> Callable[[Any], Any]:
    if (spec.transport or "local") == "local" and callable(spec.target):
        return spec.target

    def _delegating_node(state: Any) -> Any:
        result = run_agent(state, spec.name)
        if isinstance(result, dict):
            return result
        return {spec.name: result}

    return _delegating_node


def _state_text(state: Any) -> str:
    if isinstance(state, str):
        return state
    if isinstance(state, dict):
        for key in ("input", "task", "messages", "question"):
            if key in state:
                return str(state[key])
    return str(state)


def supervisor(
    _target: Any = None,
    /,
    *,
    name: Optional[str] = None,
    agents: Optional[List[str]] = None,
    router: str = "llm",
    model: str = "",
    persona: Optional[str] = None,
    instructions: str = "",
    finish: str = "__end__",
    roles: Optional[List[str]] = None,
    description: Optional[str] = None,
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register a supervisor over ``agents`` (the supervisor pattern).

    Use ``router="llm"`` (default) to let an LLM pick the next agent, or
    ``router="custom"`` and decorate a function ``(state) -> agent_name``::

        @supervisor(agents=["researcher", "writer"], router="custom")
        def triage(state) -> str:
            return "writer" if state.get("draft") else "researcher"

    Build the runnable team with ``get_supervisor(name).build()``.
    """

    def make(target: Any) -> SupervisorSpec:
        resolved = resolve_name(target, name) if target is not None else name
        if not resolved:
            raise ValueError("supervisor requires a name (or a decorated function)")
        spec = SupervisorSpec(
            name=resolved,
            target=target,
            description=resolve_description(target, description) if target else (description or ""),
            members=list(agents or []),
            router=router,
            model=model,
            persona=persona,
            instructions=instructions,
            finish=finish,
            roles=list(roles or []),
            enabled=enabled,
            metadata=dict(metadata or {}),
        )
        get_registry().add_supervisor(spec)
        return spec

    # Decorator form: @supervisor(router="custom") def fn(state): ...
    if _target is not None and callable(_target):
        make(_target)
        return _target

    if router == "custom":
        def wrap(target: Callable[..., Any]) -> Callable[..., Any]:
            make(target)
            return target

        return wrap

    # Direct registration (router="llm", no callable needed)
    return make(None)


def get_supervisor(name: str) -> Supervisor:
    """Return the :class:`Supervisor` runtime for a registered supervisor."""
    spec = get_registry().supervisors.get(name)
    if spec is None:
        raise KeyError(f"unknown supervisor: {name!r}")
    return Supervisor(spec)


# ──────────────────────────────────────────────────────────────────────────
# Swarm pattern — handoffs
# ──────────────────────────────────────────────────────────────────────────
def handoff(
    goto: str,
    *,
    update: Optional[Dict[str, Any]] = None,
    to_parent: bool = False,
) -> Any:
    """Return a LangGraph ``Command`` that hands control to ``goto``.

    Use inside a node for peer-to-peer (swarm) routing::

        @graph_node
        def triage(state):
            return handoff("billing", update={"reason": "refund"})

    Set ``to_parent=True`` to target a node in the parent graph (subgraphs).
    """
    Command = _require_command()
    kwargs: Dict[str, Any] = {"goto": goto}
    if update is not None:
        kwargs["update"] = update
    if to_parent:
        kwargs["graph"] = Command.PARENT
    return Command(**kwargs)


def make_handoff_tool(
    agent_name: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
) -> Callable[..., Any]:
    """Build a handoff *tool* callable an LLM can invoke to transfer to an agent.

    Returns a function that, when called, returns a ``Command`` routing to
    ``agent_name`` (the LangGraph swarm idiom). Register it with :func:`langstitch.tool`
    if you want it advertised to the model.
    """

    def _tool(reason: str = "") -> Any:
        update = {"handoff_reason": reason} if reason else None
        return handoff(agent_name, update=update)

    _tool.__name__ = name or f"transfer_to_{agent_name}"
    _tool.__doc__ = description or f"Transfer control to the {agent_name} agent."
    return _tool
