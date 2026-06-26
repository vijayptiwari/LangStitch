"""Shared plumbing for dual-form decorators.

Every public decorator must work both bare and parameterized::

    @skill
    def foo(...): ...

    @skill(name="bar", tools=["search"])
    def foo(...): ...

``dual_decorator`` handles that ambiguity so each decorator module only has to
describe how to build its spec.
"""
from __future__ import annotations

from typing import Any, Callable, Optional, TypeVar

T = TypeVar("T")


def resolve_name(obj: Any, explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    name = getattr(obj, "__name__", None)
    if name:
        return name
    return obj.__class__.__name__


def resolve_description(obj: Any, explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    doc = getattr(obj, "__doc__", None)
    if doc:
        return doc.strip().splitlines()[0].strip()
    return ""


def dual_decorator(build_and_register: Callable[[Any, dict], None]):
    """Wrap a ``(target, options) -> None`` registrar into a dual-form decorator.

    ``build_and_register`` receives the decorated object and the keyword options
    captured from the parameterized form, builds the appropriate spec, registers
    it, and returns nothing. The decorated object is always returned unchanged so
    decorators are transparent at call time.
    """

    def decorator(_maybe_target: Any = None, /, **options: Any):
        def wrap(target: T) -> T:
            build_and_register(target, options)
            return target

        # Bare form: @skill  (first positional is the decorated object)
        if _maybe_target is not None and callable(_maybe_target):
            return wrap(_maybe_target)
        # Parameterized form: @skill(...) -> returns the actual wrapper
        return wrap

    return decorator
