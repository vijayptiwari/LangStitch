"""``@graph`` decorator and a thin :class:`GraphBuilder` over LangGraph.

The builder mirrors LangGraph's ``StateGraph`` API but works without LangGraph
installed (it records the wiring) and compiles to a real ``StateGraph`` when the
optional ``graph`` extra is present. This keeps the SDK importable in minimal
environments (tests, codegen) while still being production-capable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from ._decorators import resolve_description, resolve_name
from .registry import GraphSpec, get_registry

__all__ = ["graph", "GraphBuilder", "START", "END"]

START = "__start__"
END = "__end__"


@dataclass
class _Edge:
    source: str
    target: str


@dataclass
class _Conditional:
    source: str
    router: Callable[..., Any]
    mapping: Dict[str, str]


class GraphBuilder:
    """Declarative graph wiring with optional LangGraph compilation."""

    def __init__(self, name: str, state_schema: Any = dict) -> None:
        self.name = name
        self.state_schema = state_schema
        self.nodes: Dict[str, Callable[..., Any]] = {}
        self.edges: List[_Edge] = []
        self.conditionals: List[_Conditional] = []
        self.entry: Optional[str] = None

    def add_node(self, name: str, handler: Callable[..., Any]) -> "GraphBuilder":
        self.nodes[name] = handler
        return self

    def add_edge(self, source: str, target: str) -> "GraphBuilder":
        self.edges.append(_Edge(source, target))
        return self

    def add_conditional_edges(
        self, source: str, router: Callable[..., Any], mapping: Dict[str, str]
    ) -> "GraphBuilder":
        self.conditionals.append(_Conditional(source, router, mapping))
        return self

    def set_entry_point(self, name: str) -> "GraphBuilder":
        self.entry = name
        return self

    def compile(self, **kwargs: Any) -> Any:
        """Compile to a LangGraph ``CompiledStateGraph``.

        Raises a helpful error if LangGraph isn't installed.
        """
        try:
            from langgraph.graph import StateGraph
        except ImportError as exc:  # pragma: no cover - depends on optional extra
            raise RuntimeError(
                "GraphBuilder.compile() requires LangGraph. Install it with:\n"
                "    pip install 'langstitch[graph]'"
            ) from exc

        sg = StateGraph(self.state_schema)
        for node_name, handler in self.nodes.items():
            sg.add_node(node_name, handler)
        if self.entry:
            sg.set_entry_point(self.entry)
        for edge in self.edges:
            sg.add_edge(_translate(edge.source), _translate(edge.target))
        for cond in self.conditionals:
            sg.add_conditional_edges(cond.source, cond.router, cond.mapping)
        return sg.compile(**kwargs)

    def describe(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "entry": self.entry,
            "nodes": list(self.nodes),
            "edges": [(e.source, e.target) for e in self.edges],
            "conditionals": [
                {"source": c.source, "mapping": c.mapping} for c in self.conditionals
            ],
        }


def _translate(node: str) -> str:
    try:
        from langgraph.graph import END as LG_END, START as LG_START

        if node == START:
            return LG_START
        if node == END:
            return LG_END
    except ImportError:  # pragma: no cover
        pass
    return node


def graph(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    entrypoint: bool = False,
    parent: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Register a graph builder function.

    The decorated function should return either a :class:`GraphBuilder`, a
    compiled LangGraph, or any callable graph. Mark the top-level graph with
    ``entrypoint=True``; subgraphs set ``parent`` to their owner's name.
    """

    def wrap(target: Callable[..., Any]) -> Callable[..., Any]:
        spec = GraphSpec(
            name=resolve_name(target, name),
            target=target,
            description=resolve_description(target, description),
            entrypoint=entrypoint,
            parent=parent,
            metadata=dict(metadata or {}),
        )
        get_registry().add_graph(spec)
        return target

    if _target is not None and callable(_target):
        return wrap(_target)
    return wrap
