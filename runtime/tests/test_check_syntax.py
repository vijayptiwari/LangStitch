import json
import subprocess
import sys
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1] / "check_syntax.py"


def test_valid_python():
    raw = subprocess.run(
        [sys.executable, str(RUNTIME)],
        input=json.dumps({"files": {"ok.py": "x = 1\n"}}),
        text=True,
        capture_output=True,
        check=True,
    )
    assert json.loads(raw.stdout) == []


def test_invalid_python():
    raw = subprocess.run(
        [sys.executable, str(RUNTIME)],
        input=json.dumps({"files": {"bad.py": "def f(\n"}}),
        text=True,
        capture_output=True,
        check=True,
    )
    out = json.loads(raw.stdout)
    assert len(out) == 1
    assert out[0]["severity"] == "error"
    assert out[0]["file"] == "bad.py"
