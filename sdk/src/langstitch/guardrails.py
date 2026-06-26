"""``@input_guardrail`` / ``@output_guardrail`` — validate data entering and
leaving the graph."""
from __future__ import annotations

from typing import Any, Callable, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import GuardrailSpec, get_registry

__all__ = ["input_guardrail", "output_guardrail"]


def _make(stage: str):
    def _register(target: Callable[..., Any], options: dict) -> None:
        spec = GuardrailSpec(
            name=resolve_name(target, options.get("name")),
            target=target,
            description=resolve_description(target, options.get("description")),
            stage=stage,
            action=options.get("action", "block"),
            severity=options.get("severity", "medium"),
            enabled=options.get("enabled", True),
            metadata=dict(options.get("metadata", {})),
        )
        get_registry().add_guardrail(spec)

    return _register


def input_guardrail(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    action: str = "block",
    severity: str = "medium",
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register a guardrail that runs on inbound requests."""
    return dual_decorator(_make("input"))(
        _target, name=name, description=description, action=action,
        severity=severity, enabled=enabled, metadata=metadata or {},
    )


def output_guardrail(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    action: str = "block",
    severity: str = "medium",
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register a guardrail that runs on generated responses."""
    return dual_decorator(_make("output"))(
        _target, name=name, description=description, action=action,
        severity=severity, enabled=enabled, metadata=metadata or {},
    )
