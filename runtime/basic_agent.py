#!/usr/bin/env python3
"""LangStitch basic agent — minimal runnable graph for smoke tests."""

from __future__ import annotations

import json
import sys


def run_graph(state: dict) -> dict:
    """Simulates Start -> LLM Assistant -> End."""
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


def main() -> int:
    initial = {"messages": [{"role": "user", "content": "Hello agent"}]}
    result = run_graph(initial)
    payload = {"ok": True, "graph": "basic_agent", "result": result}
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
