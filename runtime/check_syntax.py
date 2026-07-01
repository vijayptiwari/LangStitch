"""Check Python syntax for in-memory virtual files (stdin JSON)."""
from __future__ import annotations

import ast
import json
import sys
from typing import Any


def check_content(path: str, content: str) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    try:
        ast.parse(content)
    except SyntaxError as exc:
        diagnostics.append(
            {
                "severity": "error",
                "message": exc.msg or "Syntax error",
                "file": path,
                "line": exc.lineno or 1,
            }
        )
    return diagnostics


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("[]")
        return 0
    payload = json.loads(raw)
    files: dict[str, str] = payload.get("files", {})
    out: list[dict[str, Any]] = []
    for path, content in sorted(files.items()):
        if not path.endswith(".py"):
            continue
        out.extend(check_content(path, content))
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
