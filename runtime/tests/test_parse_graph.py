"""Tests for runtime/parse_graph.py"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "runtime" / "parse_graph.py"
FIXTURE = ROOT / "e2e" / "fixtures" / "sync" / "sample_project"


def test_parse_graph_returns_json():
    FIXTURE.mkdir(parents=True, exist_ok=True)
    nodes_dir = FIXTURE / "src" / "demo" / "nodes"
    nodes_dir.mkdir(parents=True, exist_ok=True)
    (nodes_dir / "llm_1.py").write_text(
        '''# langstitch:node id=llm-1 kind=llm label="Assistant"
from demo.state import State

def llm_1(state: State) -> dict:
    # region CUSTOM
    return {"messages": []}
    # endregion CUSTOM
''',
        encoding="utf-8",
    )
    (nodes_dir / "__init__.py").write_text("", encoding="utf-8")

    proc = subprocess.run(
        [sys.executable, str(SCRIPT), str(FIXTURE)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(proc.stdout)
    assert len(data["nodes"]) >= 1
    assert data["nodes"][0]["customCode"].strip().startswith("return")
