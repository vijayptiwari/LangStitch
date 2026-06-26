"""``@graph_node`` — register a function as a LangGraph node handler."""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import NodeSpec, get_registry

__all__ = ["graph_node"]


def _register(target: Callable[..., Any], options: dict) -> None:
    spec = NodeSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        kind=options.get("kind", "function"),
        tags=list(options.get("tags", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_node(spec)


def graph_node(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    kind: str = "function",
    tags: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated function as a graph node.

    A node handler receives the graph state (a dict / TypedDict) and returns a
    dict of state updates. The handler is left untouched and can still be called
    directly in tests.
    """
    return dual_decorator(_register)(_target, name=name, description=description, kind=kind, tags=tags or [], metadata=metadata or {})
