#!/usr/bin/env python3
"""LangStitch basic agent — SDK graph with optional LangSmith registration."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from langstitch import END, GraphBuilder, LangStitchApp, configure_tracing, get_logger, graph, graph_node
from langstitch.tracing import registered_graphs

ROOT = Path(__file__).resolve().parent
log = get_logger(__name__)


@graph_node(description="Echo assistant for smoke tests.")
def assistant(state: dict) -> dict:
    messages = list(state.get("messages", []))
    user_text = ""
    if messages:
        last = messages[-1]
        user_text = last.get("content", "") if isinstance(last, dict) else str(last)

    reply = (
        f"Hello! I'm your basic LangStitch agent (gpt-4o-mini). "
        f"You said: {user_text or 'nothing yet'}"
    )
    messages.append({"role": "assistant", "content": reply})
    return {"messages": messages, "result": reply}


@graph(name="basic_agent", entrypoint=True, description="Start -> assistant -> End")
def basic_agent_graph() -> GraphBuilder:
    builder = GraphBuilder("basic_agent")
    builder.add_node("assistant", assistant)
    builder.set_entry_point("assistant")
    builder.add_edge("assistant", END)
    return builder


def run(initial: dict | None = None) -> dict:
    """Bootstrap the SDK app, register the graph, and invoke it."""
    configure_tracing()
    app = LangStitchApp.bootstrap(root=ROOT)
    state = initial or {"messages": [{"role": "user", "content": "Hello agent"}]}

    try:
        result = app.invoke(state)
    except RuntimeError as exc:
        log.warning("Compiled graph unavailable (%s); running assistant node directly", exc)
        result = assistant(state)

    reg = registered_graphs().get("basic_agent", {})
    return {
        "ok": True,
        "graph": "basic_agent",
        "result": result,
        "tracing": {
            "registered": bool(reg),
            "langsmith": reg.get("langsmith", False),
            "project": reg.get("project"),
        },
    }


def main() -> int:
    payload = run()
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
