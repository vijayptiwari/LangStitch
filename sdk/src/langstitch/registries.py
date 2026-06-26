"""Dynamic Tool & Agent registries with lazy materialization.

Design goals (per the SDK architecture):

* **Dynamic refresh** — the registry indexes specs from the global decorator
  registry *plus* pluggable loaders (e.g. MCP servers, plugins). It auto-refreshes
  when the global registry changes (tracked via a monotonic ``revision``) and can
  be force-refreshed at runtime.
* **No eager loading** — when a request/agent arrives we do *not* instantiate
  every tool, guardrail, or worker agent. The registry keeps cheap *specs*;
  the actual callables are materialized only when a node selects them for an LLM
  decision (see :mod:`langstitch.context`).
* **Selection** — nodes pull a focused subset by ``names``/``tags``/``roles``,
  which is what gets injected into the temporary LLM context.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, Generic, List, Optional, Sequence, TypeVar

from .registry import (
    AgentSpec,
    GuardrailSpec,
    PersonaSpec,
    PolicySpec,
    SkillSpec,
    ToolSpec,
    get_registry,
)

__all__ = [
    "ToolRegistry",
    "AgentRegistry",
    "get_tool_registry",
    "get_agent_registry",
    "get_all_tools",
    "get_all_worker_agents",
    "get_input_guardrails",
    "get_output_guardrails",
    "get_skills",
    "get_policies",
    "get_personas",
    "refresh_registries",
]

S = TypeVar("S")  # spec type
Loader = Callable[[], Sequence[Any]]


class _LazyRegistry(Generic[S]):
    """Index of specs that refreshes lazily and materializes on demand."""

    def __init__(self, kind: str, base: Callable[[], Dict[str, S]], *, ttl: Optional[float] = None) -> None:
        self._kind = kind
        self._base = base  # pulls specs from the global registry
        self._loaders: List[Loader] = []
        self._ttl = ttl
        self._index: Dict[str, S] = {}
        self._materialized: Dict[str, Any] = {}
        self._loaded_revision = -1
        self._loaded_at = 0.0
        self._lock = threading.RLock()

    # ── loaders / refresh ──
    def add_loader(self, loader: Loader) -> "_LazyRegistry[S]":
        """Register an external source of specs (called on every refresh)."""
        with self._lock:
            self._loaders.append(loader)
            self._loaded_revision = -1  # force refresh on next access
        return self

    def _is_stale(self) -> bool:
        if self._loaded_revision != get_registry().revision:
            return True
        if self._ttl is not None and (time.time() - self._loaded_at) > self._ttl:
            return True
        return False

    def refresh(self, *, force: bool = True) -> "_LazyRegistry[S]":
        with self._lock:
            if not force and not self._is_stale():
                return self
            index: Dict[str, S] = dict(self._base())
            for loader in self._loaders:
                for spec in loader():
                    index[spec.name] = spec  # loaders override base by name
            self._index = index
            self._materialized.clear()
            self._loaded_revision = get_registry().revision
            self._loaded_at = time.time()
        return self

    def _ensure(self) -> None:
        if self._is_stale():
            self.refresh(force=True)

    def invalidate(self) -> None:
        with self._lock:
            self._loaded_revision = -1

    # ── queries (cheap, spec-only) ──
    def all(self) -> List[S]:
        self._ensure()
        return list(self._index.values())

    def names(self) -> List[str]:
        self._ensure()
        return sorted(self._index)

    def get(self, name: str) -> Optional[S]:
        self._ensure()
        return self._index.get(name)

    def __contains__(self, name: str) -> bool:
        self._ensure()
        return name in self._index

    def __len__(self) -> int:
        self._ensure()
        return len(self._index)

    def select(
        self,
        *,
        names: Optional[Sequence[str]] = None,
        tags: Optional[Sequence[str]] = None,
        roles: Optional[Sequence[str]] = None,
        enabled_only: bool = True,
    ) -> List[S]:
        """Return specs matching the filter (used to build LLM context)."""
        self._ensure()
        out: List[S] = []
        want_names = set(names) if names else None
        want_tags = set(tags) if tags else None
        want_roles = set(roles) if roles else None
        for spec in self._index.values():
            if enabled_only and not getattr(spec, "enabled", True):
                continue
            if want_names is not None and spec.name not in want_names:
                continue
            if want_tags is not None and not (want_tags & set(getattr(spec, "tags", []))):
                continue
            if want_roles is not None:
                spec_roles = set(getattr(spec, "roles", []))
                # a spec with no roles is unrestricted (available to all)
                if spec_roles and not (want_roles & spec_roles):
                    continue
            out.append(spec)
        return out

    # ── lazy materialization ──
    def materialize(self, name: str) -> Any:
        """Resolve a spec's target into a usable object, cached per refresh."""
        self._ensure()
        with self._lock:
            if name in self._materialized:
                return self._materialized[name]
            spec = self._index.get(name)
            if spec is None:
                raise KeyError(f"unknown {self._kind}: {name!r}")
            obj = self._resolve(spec)
            self._materialized[name] = obj
            return obj

    def bind(self, specs: Sequence[S]) -> List[Any]:
        """Materialize a list of selected specs (for injection into context)."""
        return [self.materialize(s.name) for s in specs]

    def _resolve(self, spec: S) -> Any:  # overridable hook
        return getattr(spec, "target", spec)


class ToolRegistry(_LazyRegistry[ToolSpec]):
    def __init__(self, *, ttl: Optional[float] = None) -> None:
        super().__init__("tool", lambda: dict(get_registry().tools), ttl=ttl)


class AgentRegistry(_LazyRegistry[AgentSpec]):
    def __init__(self, *, ttl: Optional[float] = None) -> None:
        super().__init__("worker_agent", lambda: dict(get_registry().worker_agents), ttl=ttl)


_TOOL_REGISTRY = ToolRegistry()
_AGENT_REGISTRY = AgentRegistry()


def get_tool_registry() -> ToolRegistry:
    return _TOOL_REGISTRY


def get_agent_registry() -> AgentRegistry:
    return _AGENT_REGISTRY


# ── convenience accessors (used by the graph server) ──
def get_all_tools() -> List[ToolSpec]:
    return _TOOL_REGISTRY.all()


def get_all_worker_agents() -> List[AgentSpec]:
    return _AGENT_REGISTRY.all()


def get_input_guardrails() -> List[GuardrailSpec]:
    return list(get_registry().input_guardrails.values())


def get_output_guardrails() -> List[GuardrailSpec]:
    return list(get_registry().output_guardrails.values())


def get_skills() -> List[SkillSpec]:
    return list(get_registry().skills.values())


def get_policies() -> List[PolicySpec]:
    return sorted(
        get_registry().policies.values(), key=lambda p: p.priority, reverse=True
    )


def get_personas() -> List[PersonaSpec]:
    return list(get_registry().personas.values())


def refresh_registries() -> None:
    """Force a refresh of all dynamic registries."""
    _TOOL_REGISTRY.refresh(force=True)
    _AGENT_REGISTRY.refresh(force=True)
