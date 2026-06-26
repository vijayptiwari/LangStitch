"""``@business_policy`` — register an organizational/business rule."""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import PolicySpec, get_registry

__all__ = ["business_policy"]


def _register(target: Callable[..., Any], options: dict) -> None:
    spec = PolicySpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        priority=int(options.get("priority", 0)),
        enabled=options.get("enabled", True),
        tags=list(options.get("tags", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_policy(spec)


def business_policy(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    priority: int = 0,
    enabled: bool = True,
    tags: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as a business policy.

    Policies are evaluated by ``priority`` (highest first) and can short-circuit
    a request when they return a non-allowed decision.
    """
    return dual_decorator(_register)(
        _target, name=name, description=description, priority=priority,
        enabled=enabled, tags=tags or [], metadata=metadata or {},
    )
