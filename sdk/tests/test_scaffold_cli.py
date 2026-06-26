"""Scaffold generation + CLI `new` command produce a coherent project."""
import subprocess
import sys

from langstitch.cli import main as cli_main
from langstitch.scaffold import build_scaffold, slugify


def test_slugify():
    assert slugify("My Cool App") == "my_cool_app"
    assert slugify("123start") == "app_123start"
    assert slugify("!!!") == "app"


def test_build_scaffold_has_core_files():
    files = build_scaffold("My Agent")
    assert "application.yaml" in files
    assert "env.yaml" in files
    assert "pyproject.toml" in files
    assert "app/main.py" in files
    assert "app/graphs/main.py" in files
    assert "app/nodes/respond.py" in files
    assert "tests/test_smoke.py" in files
    # application.yaml uses the slug
    assert "name: my_agent" in files["application.yaml"]


def test_cli_new_writes_project(tmp_path):
    target = tmp_path / "proj"
    rc = cli_main(["new", "demo", "--dir", str(target)])
    assert rc == 0
    assert (target / "application.yaml").exists()
    assert (target / "app" / "main.py").exists()
    assert (target / "tests" / "test_smoke.py").exists()


def test_cli_new_refuses_nonempty(tmp_path):
    target = tmp_path / "proj"
    target.mkdir()
    (target / "keep.txt").write_text("x", encoding="utf-8")
    rc = cli_main(["new", "demo", "--dir", str(target)])
    assert rc == 1


def test_generated_project_smoke(tmp_path):
    """The scaffolded project's own smoke test should pass."""
    target = tmp_path / "gen"
    assert cli_main(["new", "demo", "--dir", str(target)]) == 0
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", str(target / "tests")],
        cwd=str(target),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
