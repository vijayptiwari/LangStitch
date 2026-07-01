"""Regression tests for the /api/export endpoint.

Guards two bugs that made "Export Project" fail:
1. StreamingResponse(BytesIO) returned no Content-Length, stalling the browser
   download behind BaseHTTPMiddleware. Export now returns a plain Response with
   an explicit Content-Length.
2. The zip exclusion filtered on the *absolute* path's parts. Because the
   workspace root lives under ~/.langstitch, every file contained a
   ".langstitch" segment and was excluded -> empty zip. Exclusion now uses the
   path relative to the project base.

Run: python -m pytest server/test_export.py   (or: python server/test_export.py)
"""
import io
import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault(
    "LANGSTITCH_WORKSPACE",
    os.path.join(tempfile.gettempdir(), ".langstitch", "ls_test_ws"),
)
os.environ.setdefault("LANGSTITCH_AUTH_ENABLED", "false")

from starlette.testclient import TestClient  # noqa: E402

from server.main import app  # noqa: E402

client = TestClient(app)


def _export(project_id: str = "export_test_proj"):
    return client.post(
        "/api/export",
        json={
            "project_id": project_id,
            "format": "full",
            "files": {
                "graph.py": "print('hello')\n",
                "project.json": "{}",
            },
        },
    )


def test_export_returns_zip_with_files():
    res = _export()
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    # Bug #1: Content-Length must be present so the client knows when to stop.
    assert int(res.headers["content-length"]) == len(res.content)

    zf = zipfile.ZipFile(io.BytesIO(res.content))
    names = zf.namelist()
    # Bug #2: the project files must actually be in the archive.
    assert "graph.py" in names, f"graph.py missing from export: {names}"
    assert "project.json" in names, f"project.json missing from export: {names}"
    assert len(names) > 2, f"helm chart files missing from export: {names}"


def test_export_excludes_internal_metadata():
    res = _export("export_meta_proj")
    assert res.status_code == 200
    names = zipfile.ZipFile(io.BytesIO(res.content)).namelist()
    assert not any(".git" in n.split("/") for n in names)
    assert not any(".langstitch" in n.split("/") for n in names)


if __name__ == "__main__":
    test_export_returns_zip_with_files()
    test_export_excludes_internal_metadata()
    print("export regression tests passed")
