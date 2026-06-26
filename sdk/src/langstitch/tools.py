"""``@tool`` — register a callable an LLM can invoke during a decision.

Tools are intentionally lightweight to declare. They are *not* eagerly loaded
into every request; the dynamic :class:`~langstitch.registries.ToolRegistry`
holds their specs and only materializes the callables when a node actually asks
for them (see ``langstitch.context``).
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import ToolSpec, get_registry

__all__ = ["tool"]


def _register(target: Callable[..., Any], options: dict) -> None:
    spec = ToolSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        roles=list(options.get("roles", [])),
        tags=list(options.get("tags", [])),
        input_schema=options.get("input_schema"),
        enabled=options.get("enabled", True),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_tool(spec)


def tool(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    roles: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    input_schema: Optional[Dict[str, Any]] = None,
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as an LLM tool.

    ``roles`` gates who/what may use the tool; ``tags`` drive context-time
    selection so a node can pull only the relevant subset.
    """
    return dual_decorator(_register)(
        _target,
        name=name,
        description=description,
        roles=roles or [],
        tags=tags or [],
        input_schema=input_schema,
        enabled=enabled,
        metadata=metadata or {},
    )
