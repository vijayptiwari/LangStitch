"""Delegatable agents — local, remote graph, or A2A.

* ``@worker_agent`` / ``@agent`` — register a *local* sub-agent: a callable a
  node hands a focused task to. Like tools they are lazily materialized.
* ``@agent(transport=...)`` / ``remote_agent`` / ``a2a_agent`` — register a
  *remote* agent (an HTTP graph or an A2A peer) the app can delegate to.

All three populate the same ``worker_agents`` registry as :class:`AgentSpec`
records, so :func:`langstitch.run_agent` can dispatch to any of them uniformly
while reusing the SDK auth + RBAC layers.
"""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import AgentSpec, get_registry

__all__ = ["worker_agent", "agent", "remote_agent"]


def _register(target: Callable[..., Any], options: dict) -> None:
    spec = AgentSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        role=options.get("role", ""),
        tools=list(options.get("tools", [])),
        persona=options.get("persona"),
        tags=list(options.get("tags", [])),
        enabled=options.get("enabled", True),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_worker_agent(spec)


def worker_agent(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    role: str = "",
    tools: Optional[List[str]] = None,
    persona: Optional[str] = None,
    tags: Optional[List[str]] = None,
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable/class as a worker (sub) agent.

    ``tools`` lists the tool names this agent is allowed to use; the context
    builder restricts the agent's child context to exactly those.
    """
    return dual_decorator(_register)(
        _target,
        name=name,
        description=description,
        role=role,
        tools=tools or [],
        persona=persona,
        tags=tags or [],
        enabled=enabled,
        metadata=metadata or {},
    )


def agent(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    transport: str = "local",
    url: str = "",
    service: str = "",
    auth_env: str = "",
    roles: Optional[List[str]] = None,
    description: Optional[str] = None,
    role: str = "",
    tools: Optional[List[str]] = None,
    persona: Optional[str] = None,
    tags: Optional[List[str]] = None,
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register a delegatable agent of any ``transport`` (local/remote/a2a).

    Two forms:

    * **Local** (decorator on a callable)::

        @agent(tools=["web"], roles=["analyst"])
        def researcher(state): ...

    * **Remote / A2A** (direct call, no local callable)::

        agent(name="legal", transport="remote",
              url="https://legal/invoke", service="legal_svc", roles=["counsel"])
        agent(name="billing", transport="a2a",
              url="https://billing/.well-known/agent.json", service="billing_a2a")

    For ``a2a`` agents ``url`` is the Agent Card URL. ``service`` / ``auth_env``
    wire outbound auth through the SDK services layer. ``roles`` gates which
    callers may delegate here (RBAC), and is enforced by :func:`langstitch.run_agent`.
    """

    def build(target: Callable[..., Any]) -> Callable[..., Any]:
        spec = AgentSpec(
            name=resolve_name(target, name),
            target=target,
            description=resolve_description(target, description),
            role=role,
            tools=list(tools or []),
            persona=persona,
            tags=list(tags or []),
            enabled=enabled,
            transport="local",
            roles=list(roles or []),
            metadata=dict(metadata or {}),
        )
        get_registry().add_worker_agent(spec)
        return target

    # Bare decorator: @agent
    if _target is not None and callable(_target):
        return build(_target)

    # Parameterized local decorator: @agent(...)
    if transport == "local":
        return build

    # Remote / A2A registration (no local callable)
    if not name:
        raise ValueError(f"{transport!r} agent requires an explicit name=")
    spec = AgentSpec(
        name=name,
        target=None,
        description=description or "",
        role=role,
        tools=list(tools or []),
        persona=persona,
        tags=list(tags or []),
        enabled=enabled,
        transport=transport,
        url=url,
        service=service,
        auth_env=auth_env,
        roles=list(roles or []),
        metadata=dict(metadata or {}),
    )
    get_registry().add_worker_agent(spec)
    return spec


def remote_agent(
    name: str,
    *,
    url: str = "",
    service: str = "",
    auth_env: str = "",
    roles: Optional[List[str]] = None,
    description: str = "",
    tools: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
) -> AgentSpec:
    """Register a remote graph agent (an HTTP ``/invoke`` endpoint).

    Auth reuses the SDK services layer: pass ``service`` to reference an
    ``external_services`` entry, or ``auth_env`` to read a bearer token from the
    environment. Returns the spec for convenience.
    """
    return agent(
        name=name,
        transport="remote",
        url=url,
        service=service,
        auth_env=auth_env,
        roles=roles,
        description=description,
        tools=tools,
        metadata=metadata,
    )
