"""``@skill`` — register a reusable capability the agent can invoke."""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import SkillSpec, get_registry

__all__ = ["skill"]


def _register(target: Callable[..., Any], options: dict) -> None:
    spec = SkillSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        tools=list(options.get("tools", [])),
        persona=options.get("persona"),
        tags=list(options.get("tags", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_skill(spec)


def skill(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tools: Optional[List[str]] = None,
    persona: Optional[str] = None,
    tags: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as a skill."""
    return dual_decorator(_register)(
        _target,
        name=name,
        description=description,
        tools=tools or [],
        persona=persona,
        tags=tags or [],
        metadata=metadata or {},
    )
