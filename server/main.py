"""LangStitch platform API — git, export, import, build, deploy."""

from __future__ import annotations

import io
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .auth import (
    get_current_user_id,
    reset_current_user_id,
    router as auth_router,
    set_current_user_id,
    user_id_from_authorization,
)
from .config import settings
from .eval_service import EvalConfigInput, run_eval_job
from .marketplace import router as marketplace_router

BUILD_TIME = datetime.now(timezone.utc).isoformat()

EXPORT_RATE_LIMIT = 5
EXPORT_RATE_WINDOW_SEC = 60
_export_timestamps: dict[str, list[float]] = defaultdict(list)


def check_export_rate_limit(project_id: str) -> None:
    """Rate-limit /api/export (cycles 160, 220, 280, 340 — friendly 429 message)."""
    now = time.time()
    window = _export_timestamps[project_id]
    _export_timestamps[project_id] = [t for t in window if now - t < EXPORT_RATE_WINDOW_SEC]
    if len(_export_timestamps[project_id]) >= EXPORT_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many export requests. Please wait a moment and try again.",
        )
    _export_timestamps[project_id].append(now)

app = FastAPI(title="LangStitch Platform API", version="0.2.0")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach X-Request-ID to every response (cycles 148, 208, 268, 328)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# Paths that never require authentication at the middleware layer. Marketplace
# browse is public; its mutating/profile endpoints enforce auth themselves via
# the request-scoped user id (see server/marketplace.py).
_PUBLIC_AUTH_PREFIXES = (
    "/api/health",
    "/api/auth",
    "/api/openapi.json",
    "/api/marketplace",
)


def _bearer_user_id(scope) -> str | None:
    """Resolve a user id from an Authorization: Bearer header in an ASGI scope."""
    for key, value in scope.get("headers", []):
        if key == b"authorization":
            try:
                return user_id_from_authorization(value.decode("latin-1"))
            except Exception:  # noqa: BLE001
                return None
    return None


class AuthMiddleware:
    """Pure-ASGI middleware that enforces login on protected /api routes and
    publishes the current user id to a contextvar for workspace scoping."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        method = scope.get("method", "GET")
        session = scope.get("session") or {}
        user_id = session.get("user_id") or _bearer_user_id(scope)
        is_api = path.startswith("/api/")
        is_public = any(path.startswith(p) for p in _PUBLIC_AUTH_PREFIXES)
        if is_api and method != "OPTIONS" and not is_public and not user_id:
            response = JSONResponse({"detail": "Authentication required"}, status_code=401)
            await response(scope, receive, send)
            return
        token = set_current_user_id(str(user_id) if user_id else None)
        try:
            await self.app(scope, receive, send)
        finally:
            reset_current_user_id(token)


# Middleware are applied outermost-first in reverse registration order, so the
# final order is: CORS -> Session -> Auth -> RequestId -> routes.
app.add_middleware(RequestIdMiddleware)

if settings.auth_enabled:
    from starlette.middleware.sessions import SessionMiddleware

    app.add_middleware(AuthMiddleware)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        https_only=settings.cookie_secure,
        same_site=settings.cookie_same_site,
        max_age=settings.session_max_age,
        # Share the session across subdomains (IDE + marketplace) when set.
        domain=settings.cookie_domain or None,
    )

# With cookie-based sessions we cannot use a wildcard origin; pin to the
# configured sites (IDE + marketplace + any explicit CORS origins).
_cors_origins = settings.cors_origins if settings.auth_enabled else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(marketplace_router)


@app.on_event("startup")
def _on_startup() -> None:
    if settings.auth_enabled:
        from .db import init_db, run_migrations
        from .marketplace import seed_marketplace

        run_migrations()
        init_db()
        try:
            seed_marketplace()
        except Exception:  # noqa: BLE001 - seeding is best-effort, never fatal
            pass

WORKSPACE_ROOT = Path(os.environ.get("LANGSTITCH_WORKSPACE", Path.home() / ".langstitch" / "workspaces"))
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

REPO_ROOT = Path(__file__).resolve().parent.parent
HELM_CHART = REPO_ROOT / "deploy" / "helm" / "langstitch"
RUNTIME_AGENT = REPO_ROOT / "runtime" / "basic_agent.py"

DOCUMENT_KEYS = {
    "version", "name", "description", "stateFields", "subgraphs", "activeSubgraphId",
    "settings", "remoteGraphs", "toolRegistry", "agentRegistry", "mcpServers",
    "skillRegistry", "guardrailRegistry", "businessRuleRegistry", "personaRegistry", "ragPipelines",
    "componentRegistry",
}


def extract_document(data: dict) -> dict:
    return {k: data[k] for k in DOCUMENT_KEYS if k in data}


# ─── Models ───


class GitConnectRequest(BaseModel):
    project_id: str
    remote_url: str | None = None
    branch: str = "main"
    username: str | None = None
    token: str | None = None


class GitCommitRequest(BaseModel):
    project_id: str
    message: str
    author_name: str = "LangStitch"
    author_email: str = "dev@langstitch.local"


class GitSyncRequest(BaseModel):
    project_id: str
    strategy: str = "pull"  # pull | fetch


class ProjectPayload(BaseModel):
    project_id: str
    document: dict[str, Any]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    canvasByGraph: dict[str, Any] | None = None
    navigationPath: list[str] | None = None


class AgentRunRequest(BaseModel):
    project_id: str = "basic_agent_test"
    python_code: str | None = None


class EvalConfigPayload(BaseModel):
    enabled: bool = True
    dataset_name: str = ""
    dataset_id: str = ""
    experiment_prefix: str = ""
    max_concurrency: int = 2
    description: str = ""


class EvalRunRequest(BaseModel):
    project_id: str
    eval_config: EvalConfigPayload
    langsmith_project: str = "langstitch-graph"
    api_key_env: str = "LANGCHAIN_API_KEY"
    dry_run: bool = False


class ExportRequest(BaseModel):
    project_id: str
    format: str = "full"  # python | spring | full
    files: dict[str, str]


class BuildRequest(BaseModel):
    project_id: str
    target: str = "python"  # python | spring | all


class DeployRequest(BaseModel):
    project_id: str
    release_name: str | None = None
    namespace: str = "default"
    image_tag: str = "latest"
    dry_run: bool = False


class VersionSnapshotRequest(BaseModel):
    project_id: str
    label: str | None = None


# ─── Helpers ───


def safe_slug(project_id: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in project_id)


def user_workspace_root() -> Path:
    """Workspace root for the current request — scoped per user when auth is on."""
    if settings.auth_enabled:
        uid = get_current_user_id()
        if uid:
            return WORKSPACE_ROOT / "users" / safe_slug(uid)
    return WORKSPACE_ROOT


def project_dir(project_id: str) -> Path:
    path = user_workspace_root() / safe_slug(project_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def versions_dir(project_id: str) -> Path:
    d = project_dir(project_id) / ".langstitch" / "versions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def git_env(token: str | None, username: str | None) -> dict[str, str]:
    env = os.environ.copy()
    if token:
        env["GIT_ASKPASS"] = "echo"
        env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def run_git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        raise HTTPException(
            status_code=400,
            detail=result.stderr.strip() or result.stdout.strip() or "git command failed",
        )
    return result


def write_project_files(base: Path, files: dict[str, str]) -> None:
    for rel, content in files.items():
        dest = base / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")


def copy_helm_chart(dest: Path) -> None:
    helm_dest = dest / "deploy" / "helm" / "langstitch"
    if HELM_CHART.exists():
        if helm_dest.exists():
            shutil.rmtree(helm_dest)
        shutil.copytree(HELM_CHART, helm_dest)
    else:
        helm_dest.mkdir(parents=True, exist_ok=True)
        (helm_dest / "Chart.yaml").write_text(
            "apiVersion: v2\nname: langstitch\ndescription: LangStitch graph deployment\nversion: 0.1.0\nappVersion: \"0.1.0\"\n",
            encoding="utf-8",
        )


def load_project_json(base: Path) -> dict[str, Any]:
    for name in ("langstitch.project.json", "project.langstitch.json"):
        p = base / name
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="langstitch.project.json not found in workspace")


# ─── Health ───


def count_workspace_nodes() -> int:
    total = 0
    root = user_workspace_root()
    if not root.exists():
        return 0
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        for name in ("langstitch.project.json", "project.langstitch.json"):
            project_file = entry / name
            if not project_file.exists():
                continue
            try:
                data = json.loads(project_file.read_text(encoding="utf-8"))
                total += len(data.get("nodes", []))
            except (json.JSONDecodeError, OSError):
                pass
            break
    return total


@app.get("/api/health")
def health():
    """Platform health including node-count (cycles 76, 196, 256, 316, 376)."""
    return {
        "status": "ok",
        "service": "langstitch-platform",
        "version": app.version,
        "python": sys.version.split()[0],
        "build_time": BUILD_TIME,
        "langsmith_api_key_configured": bool(os.environ.get("LANGCHAIN_API_KEY")),
        "node-count": count_workspace_nodes(),
    }


@app.get("/api/openapi.json")
def openapi_description():
    """OpenAPI-style schema describing platform export endpoints (cycles 232, 292, 352)."""
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "LangStitch Platform API",
            "version": app.version,
            "description": "Git sync, export/import, build, deploy, and eval for LangStitch projects.",
        },
        "paths": {
            "/api/export": {
                "post": {
                    "summary": "Export project as ZIP bundle",
                    "description": (
                        "Writes project files to workspace, copies Helm chart, and returns "
                        "a ZIP archive including export-manifest.json with eval-dataset metadata when configured."
                    ),
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["project_id", "files"],
                                    "properties": {
                                        "project_id": {"type": "string"},
                                        "format": {
                                            "type": "string",
                                            "enum": ["python", "spring", "full"],
                                            "default": "full",
                                        },
                                        "files": {
                                            "type": "object",
                                            "additionalProperties": {"type": "string"},
                                            "description": "Relative path → file contents",
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "ZIP export bundle",
                            "content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}},
                        },
                        "429": {
                            "description": "Rate limit exceeded",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {"detail": {"type": "string"}},
                                    }
                                }
                            },
                        },
                    },
                }
            }
        },
    }


# ─── Project ───


def register_project(project_id: str, name: str | None) -> None:
    """Record the project in the per-user registry (no-op when auth is off)."""
    if not settings.auth_enabled:
        return
    uid = get_current_user_id()
    if not uid:
        return
    from sqlalchemy import select

    from .db import session_scope
    from .models import Project

    slug = safe_slug(project_id)
    with session_scope() as db:
        proj = db.scalar(
            select(Project).where(Project.user_id == uid, Project.slug == slug)
        )
        if proj is None:
            db.add(Project(user_id=uid, slug=slug, name=name or slug))
        elif name:
            proj.name = name


@app.post("/api/project/save")
def save_project(payload: ProjectPayload):
    base = project_dir(payload.project_id)
    project_json: dict[str, Any] = {
        **payload.document,
        "nodes": payload.nodes,
        "edges": payload.edges,
    }
    if payload.canvasByGraph is not None:
        project_json["canvasByGraph"] = payload.canvasByGraph
    if payload.navigationPath is not None:
        project_json["navigationPath"] = payload.navigationPath
    (base / "langstitch.project.json").write_text(
        json.dumps(project_json, indent=2),
        encoding="utf-8",
    )
    register_project(payload.project_id, payload.document.get("name"))
    return {"ok": True, "path": str(base)}


@app.get("/api/projects")
def list_projects():
    """List the current user's projects (auth on) — used for workspace switching."""
    if not settings.auth_enabled:
        return {"projects": []}
    uid = get_current_user_id()
    if not uid:
        return {"projects": []}
    from sqlalchemy import select

    from .db import session_scope
    from .models import Project

    with session_scope() as db:
        rows = db.scalars(
            select(Project).where(Project.user_id == uid).order_by(Project.updated_at.desc())
        ).all()
        return {
            "projects": [
                {
                    "slug": p.slug,
                    "name": p.name,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in rows
            ]
        }


@app.post("/api/agent/run")
def run_agent(req: AgentRunRequest):
    """Run the basic agent or user-exported graph.py for a project."""
    base = project_dir(req.project_id)

    if req.python_code:
        graph_path = base / "graph.py"
        graph_path.write_text(req.python_code, encoding="utf-8")
    elif (base / "graph.py").exists():
        graph_path = base / "graph.py"
    elif RUNTIME_AGENT.exists():
        graph_path = RUNTIME_AGENT
    else:
        raise HTTPException(status_code=404, detail="No agent runtime found")

    result = subprocess.run(
        [sys.executable, str(graph_path)],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(base),
    )
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    parsed: dict[str, Any] | None = None
    if stdout:
        try:
            parsed = json.loads(stdout.splitlines()[-1])
        except json.JSONDecodeError:
            parsed = None

    ok = result.returncode == 0 and (parsed is None or parsed.get("ok", True))
    return {
        "ok": ok,
        "exit_code": result.returncode,
        "stdout": stdout,
        "stderr": stderr,
        "result": parsed,
        "graph_path": str(graph_path),
    }


@app.post("/api/eval/run")
def run_eval(req: EvalRunRequest):
    """Run or dry-run LangSmith eval for a project."""
    config = EvalConfigInput(
        dataset_name=req.eval_config.dataset_name,
        dataset_id=req.eval_config.dataset_id,
        experiment_prefix=req.eval_config.experiment_prefix,
        max_concurrency=req.eval_config.max_concurrency,
        description=req.eval_config.description,
        enabled=req.eval_config.enabled,
    )
    result = run_eval_job(
        config,
        langsmith_project=req.langsmith_project,
        api_key_env=req.api_key_env,
        dry_run=req.dry_run,
    )
    if not result.get("ok"):
        status = 401 if "API key" in result.get("message", "") else 400
        raise HTTPException(status_code=status, detail=result)
    return result


@app.get("/api/project/{project_id}")
def get_project(project_id: str):
    data = load_project_json(project_dir(project_id))
    document = extract_document(data)
    return {
        "document": document,
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
    }


# ─── Git ───


@app.post("/api/git/connect")
def git_connect(req: GitConnectRequest):
    base = project_dir(req.project_id)
    if not (base / ".git").exists():
        run_git(base, "init")
        run_git(base, "branch", "-M", req.branch)

    if req.remote_url:
        auth_url = req.remote_url
        if req.token and "://" in req.remote_url:
            scheme, rest = req.remote_url.split("://", 1)
            user = req.username or "git"
            auth_url = f"{scheme}://{user}:{req.token}@{rest}"
        existing = run_git(base, "remote", check=False)
        if "origin" in (existing.stdout or ""):
            run_git(base, "remote", "set-url", "origin", auth_url if req.token else req.remote_url)
        else:
            run_git(base, "remote", "add", "origin", auth_url if req.token else req.remote_url)

        if req.token:
            run_git(base, "fetch", "origin", check=False)

    status = run_git(base, "status", "--short", "--branch")
    return {
        "ok": True,
        "path": str(base),
        "branch": req.branch,
        "status": status.stdout.strip(),
    }


@app.get("/api/git/status/{project_id}")
def git_status(project_id: str):
    base = project_dir(project_id)
    if not (base / ".git").exists():
        return {"initialized": False, "branch": None, "clean": True, "files": []}
    branch = run_git(base, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    status = run_git(base, "status", "--short").stdout.strip().splitlines()
    log = run_git(base, "log", "-5", "--oneline", check=False).stdout.strip().splitlines()
    return {
        "initialized": True,
        "branch": branch,
        "clean": len(status) == 0 or status == [""],
        "files": [s.strip() for s in status if s.strip()],
        "recent_commits": log,
    }


@app.post("/api/git/sync")
def git_sync(req: GitSyncRequest):
    base = project_dir(req.project_id)
    if not (base / ".git").exists():
        raise HTTPException(status_code=400, detail="Git not initialized. Connect first.")
    if req.strategy == "fetch":
        run_git(base, "fetch", "origin")
    else:
        run_git(base, "pull", "--rebase", "origin", check=False)
    try:
        data = load_project_json(base)
        document = extract_document(data)
        return {
            "ok": True,
            "synced": True,
            "project": {
                "document": document,
                "nodes": data.get("nodes", []),
                "edges": data.get("edges", []),
            },
        }
    except HTTPException:
        return {"ok": True, "synced": True, "project": None}


@app.post("/api/git/commit")
def git_commit(req: GitCommitRequest):
    base = project_dir(req.project_id)
    if not (base / ".git").exists():
        raise HTTPException(status_code=400, detail="Git not initialized")
    run_git(base, "config", "user.name", req.author_name)
    run_git(base, "config", "user.email", req.author_email)
    run_git(base, "add", "-A")
    run_git(base, "commit", "-m", req.message, check=False)
    sha = run_git(base, "rev-parse", "HEAD").stdout.strip()
    return {"ok": True, "commit": sha}


@app.post("/api/git/push")
def git_push(req: GitSyncRequest):
    base = project_dir(req.project_id)
    if not (base / ".git").exists():
        raise HTTPException(status_code=400, detail="Git not initialized")
    run_git(base, "push", "-u", "origin", "HEAD")
    return {"ok": True}


# ─── Export / Import ───


@app.post("/api/project/files")
def write_project_files_endpoint(req: ExportRequest):
    base = project_dir(req.project_id)
    write_project_files(base, req.files)
    copy_helm_chart(base)
    return {"ok": True, "path": str(base)}


@app.options("/api/export")
async def export_project_preflight():
    """CORS preflight for browser cross-origin export requests (cycles 124, 244, 304, 364)."""
    return Response(status_code=204)


@app.post("/api/export")
def export_project(req: ExportRequest):
    check_export_rate_limit(req.project_id)
    base = project_dir(req.project_id)
    write_project_files(base, req.files)
    copy_helm_chart(base)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(base)
            # Exclude internal metadata dirs by their position *within* the
            # project, not the absolute path (the workspace root itself lives
            # under ~/.langstitch, which would otherwise exclude everything).
            if ".git" in rel.parts or ".langstitch" in rel.parts:
                continue
            zf.write(path, rel.as_posix())
    data = buf.getvalue()
    filename = f"{req.project_id}-{req.format}.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(data)),
        },
    )


@app.post("/api/import")
async def import_project(
    project_id: str,
    format: str = "langstitch",
    file: UploadFile = File(...),
):
    base = project_dir(project_id)
    content = await file.read()

    if file.filename and file.filename.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            zf.extractall(base)
    elif format == "python" or (file.filename and file.filename.endswith(".py")):
        py_path = base / "python" / "imported_graph.py"
        py_path.parent.mkdir(parents=True, exist_ok=True)
        py_path.write_bytes(content)
        # Also look for bundled project json in zip-less single file import
        if (base / "langstitch.project.json").exists():
            pass
        else:
            raise HTTPException(
                status_code=422,
                detail="Python-only import requires langstitch.project.json in workspace. Export full bundle first.",
            )
    else:
        (base / "langstitch.project.json").write_bytes(content)

    data = load_project_json(base)
    document = extract_document(data)
    return {
        "ok": True,
        "document": document,
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
    }


# ─── Versions ───


@app.post("/api/versions/snapshot")
def version_snapshot(req: VersionSnapshotRequest):
    base = project_dir(req.project_id)
    src = base / "langstitch.project.json"
    if not src.exists():
        raise HTTPException(status_code=404, detail="No project saved yet")
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    label = req.label or ts
    safe_label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)
    dest = versions_dir(req.project_id) / f"{ts}_{safe_label}.json"
    shutil.copy(src, dest)
    return {"ok": True, "version_id": dest.stem, "path": str(dest)}


@app.get("/api/versions/{project_id}")
def list_versions(project_id: str):
    vd = versions_dir(project_id)
    items = sorted(vd.glob("*.json"), reverse=True)
    return {
        "versions": [
            {"id": p.stem, "created": p.stem.split("_")[0], "label": "_".join(p.stem.split("_")[1:])}
            for p in items
        ]
    }


@app.post("/api/versions/{project_id}/restore/{version_id}")
def restore_version(project_id: str, version_id: str):
    vd = versions_dir(project_id)
    matches = list(vd.glob(f"{version_id}*.json"))
    if not matches:
        raise HTTPException(status_code=404, detail="Version not found")
    src = matches[0]
    dest = project_dir(project_id) / "langstitch.project.json"
    shutil.copy(src, dest)
    data = json.loads(dest.read_text(encoding="utf-8"))
    document = extract_document(data)
    return {
        "ok": True,
        "document": document,
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
    }


# ─── Build ───


@app.post("/api/build")
def build_project(req: BuildRequest):
    base = project_dir(req.project_id)
    logs: list[str] = []

    def run_cmd(cmd: list[str], cwd: Path) -> None:
        logs.append(f"$ {' '.join(cmd)}")
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        logs.append(r.stdout)
        if r.stderr:
            logs.append(r.stderr)
        if r.returncode != 0:
            raise HTTPException(status_code=400, detail="\n".join(logs))

    targets: list[str] = []
    if req.target in ("python", "all") and ((base / "pyproject.toml").exists() or (base / "python").exists()):
        targets.append("python")
    if req.target in ("spring", "all") and (base / "spring").exists():
        targets.append("spring")

    for t in targets:
        if t == "python":
            if (base / "pyproject.toml").exists():
                run_cmd(["pip", "install", "-e", ".[dev]"], base)
                run_cmd(["pytest", "-q"], base)
            elif (base / "python").exists():
                run_cmd(["docker", "build", "-t", f"langstitch-{req.project_id}-python", "."], base / "python")
        if t == "spring":
            run_cmd(["docker", "build", "-t", f"langstitch-{req.project_id}-spring", "."], base / "spring")

    return {"ok": True, "built": targets, "logs": "\n".join(logs)}


# ─── Deploy ───


@app.post("/api/deploy/helm")
def deploy_helm(req: DeployRequest):
    base = project_dir(req.project_id)
    chart = base / "deploy" / "helm" / "langstitch"
    if not chart.exists():
        copy_helm_chart(base)
    release = req.release_name or req.project_id.replace("_", "-")
    cmd = [
        "helm",
        "upgrade",
        "--install",
        release,
        str(chart),
        "--namespace",
        req.namespace,
        "--create-namespace",
        "--set",
        f"python.image.tag={req.image_tag}",
        "--set",
        f"spring.image.tag={req.image_tag}",
        "--set",
        f"project.name={req.project_id}",
    ]
    if req.dry_run:
        cmd.append("--dry-run")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=400, detail=result.stderr or result.stdout)
    return {"ok": True, "release": release, "output": result.stdout}


@app.get("/api/deploy/manifest/{project_id}")
def deploy_manifest(project_id: str):
    base = project_dir(project_id)
    chart = base / "deploy" / "helm" / "langstitch"
    if not chart.exists():
        copy_helm_chart(base)
    result = subprocess.run(
        ["helm", "template", project_id, str(chart)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=400, detail=result.stderr)
    return {"manifest": result.stdout}
