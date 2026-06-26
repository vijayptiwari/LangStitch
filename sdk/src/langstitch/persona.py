"""``@persona`` — register an agent persona (system identity / voice)."""
from __future__ import annotations

from typing import Any, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import PersonaSpec, get_registry

__all__ = ["persona"]


def _register(target: Any, options: dict) -> None:
    spec = PersonaSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        role=options.get("role", ""),
        tone=options.get("tone", ""),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_persona(spec)


def persona(
    _target: Any = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    role: str = "",
    tone: str = "",
    metadata: Optional[dict] = None,
):
    """Register the decorated function/class as a persona.

    A persona target typically returns (or is) the system prompt / identity used
    by skills and LLM nodes.
    """
    return dual_decorator(_register)(
        _target, name=name, description=description, role=role, tone=tone,
        metadata=metadata or {},
    )
