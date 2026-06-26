"""``@worker_agent`` — register a delegatable sub-agent.

Worker agents are sub-graphs/callables a node can hand a focused task to. Like
tools they are lazily materialized: the registry tracks specs, and a node only
spins one up (in an isolated child context) when it decides to delegate.
"""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import AgentSpec, get_registry

__all__ = ["worker_agent"]


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
