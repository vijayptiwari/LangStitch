#!/usr/bin/env python3
"""Parse LangStitch annotated Python graph files into JSON for the IDE sync engine."""
from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any

META_RE = re.compile(
    r"^#\s*langstitch:node\s+id=(\S+)\s+kind=(\S+)\s+label=(.+)$",
    re.MULTILINE,
)
CUSTOM_BEGIN = "# region CUSTOM"
CUSTOM_END = "# endregion CUSTOM"
ADD_NODE_RE = re.compile(
    r'builder\.add_node\(\s*["\']([^"\']+)["\']\s*,\s*(\w+)\s*\)',
)
ADD_EDGE_RE = re.compile(
    r'builder\.add_edge\(\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\'](?:\s*,\s*["\']([^"\']*)["\'])?\s*\)',
)


def extract_custom_region(source: str) -> str:
    begin = source.find(CUSTOM_BEGIN)
    end = source.find(CUSTOM_END)
    if begin == -1 or end == -1 or end <= begin:
        return "return {}"
    block = source[begin + len(CUSTOM_BEGIN) : end]
    lines = []
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if line.startswith("    "):
            lines.append(line[4:])
        else:
            lines.append(line)
    return "\n".join(lines).strip() or "return {}"


def parse_node_file(path: Path) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8")
    meta = META_RE.search(text)
    if not meta:
        return None
    node_id, kind, label_json = meta.groups()
    try:
        label = json.loads(label_json)
    except json.JSONDecodeError:
        label = label_json.strip('"')
    custom_code = extract_custom_region(text)
    return {
        "id": node_id,
        "kind": kind,
        "label": label,
        "customCode": custom_code,
        "modulePath": str(path).replace("\\", "/"),
    }


def parse_graph_builder(source: str) -> list[dict[str, str]]:
    edges: list[dict[str, str]] = []
    for m in ADD_EDGE_RE.finditer(source):
        src, tgt, label = m.group(1), m.group(2), m.group(3) or ""
        edges.append({"source": src, "target": tgt, "label": label})
    return edges


def parse_nodes_dir(nodes_dir: Path) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    if not nodes_dir.is_dir():
        return nodes
    for py in sorted(nodes_dir.glob("*.py")):
        if py.name == "__init__.py":
            continue
        parsed = parse_node_file(py)
        if parsed:
            nodes.append(parsed)
    return nodes


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: parse_graph.py <project_root>"}), file=sys.stderr)
        return 1
    root = Path(sys.argv[1])
    nodes_dir = None
    graph_py = None
    for candidate in root.rglob("nodes"):
        if candidate.is_dir() and (candidate / "__init__.py").exists():
            nodes_dir = candidate
            break
    for candidate in root.rglob("main.py"):
        if "graphs" in candidate.parts:
            graph_py = candidate
            break

    result: dict[str, Any] = {"nodes": [], "edges": [], "diagnostics": []}
    if nodes_dir:
        result["nodes"] = parse_nodes_dir(nodes_dir)
    else:
        result["diagnostics"].append({"severity": "warning", "message": "nodes/ directory not found"})

    if graph_py and graph_py.exists():
        try:
            result["edges"] = parse_graph_builder(graph_py.read_text(encoding="utf-8"))
        except OSError as e:
            result["diagnostics"].append({"severity": "error", "message": str(e)})
    else:
        result["diagnostics"].append({"severity": "warning", "message": "graphs/main.py not found"})

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
