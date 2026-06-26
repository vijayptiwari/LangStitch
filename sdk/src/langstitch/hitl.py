"""Human-in-the-loop (HITL) helpers.

Thin wrapper over LangGraph's ``interrupt`` primitive so node handlers can pause
graph execution and surface a payload to a human reviewer. Keeping it here means
the SDK stays importable without LangGraph installed: the import of
``langgraph.types`` only happens when :func:`human_interrupt` is actually called.
"""
from __future__ import annotations

from typing import Any

__all__ = ["human_interrupt"]


def human_interrupt(payload: dict) -> Any:
    """Pause the graph and surface ``payload`` to a human, returning the resume value.

    Wraps :func:`langgraph.types.interrupt`. When the graph is resumed (via a
    ``Command(resume=...)``), the value provided by the human is returned from
    this call so the node can continue with it::

        from langstitch import human_interrupt

        @graph_node
        def review(state: dict) -> dict:
            decision = human_interrupt({"question": "Approve?", "draft": state["draft"]})
            return {"approved": decision == "yes"}

    Requires the optional ``graph`` extra (LangGraph). A helpful error is raised
    if it is not installed.
    """
    try:
        from langgraph.types import interrupt
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise RuntimeError(
            "human_interrupt() requires LangGraph. Install it with:\n"
            "    pip install 'langstitch[graph]'"
        ) from exc
    return interrupt(payload)
