"""Plugin / connector marketplace API.

Endpoints
---------
Public (browsable without login):
    GET  /api/marketplace/plugins              list / search the catalog
    GET  /api/marketplace/plugins/{slug}       plugin detail + version history

Authenticated (require a session cookie or desktop bearer token):
    GET    /api/marketplace/my                 plugins on the current profile
    POST   /api/marketplace/plugins/{slug}/acquire    add to profile
    DELETE /api/marketplace/plugins/{slug}/acquire    remove from profile
    GET    /api/marketplace/sync               install/update manifest for the IDE

The ``sync`` endpoint is what the desktop IDE polls: it returns, for every
plugin on the user's profile, the version it should have installed plus a
download URL, so the client can install missing plugins and update stale ones.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse

from .artifacts import artifact_download_url, resolve_artifact_file, save_vsix_upload
from .auth import get_current_user_id, get_user_by_id, mint_review_token, verify_review_token
from .config import settings

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


# ─── Serialization helpers ───


def _require_db():
    """Return ``session_scope`` or fail clearly when the marketplace is offline.

    The catalog lives in MySQL, which is only configured when auth is enabled.
    """
    if not settings.auth_enabled:
        raise HTTPException(
            status_code=503,
            detail="Marketplace is unavailable: authentication/database is not configured.",
        )
    from .db import session_scope

    return session_scope


def _require_user() -> str:
    uid = get_current_user_id()
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_admin() -> dict[str, Any]:
    """Require a logged-in user whose email is a configured reviewer."""
    uid = _require_user()
    user = get_user_by_id(uid)
    if not user or not settings.is_admin_email(user.get("email")):
        raise HTTPException(status_code=403, detail="Reviewer access required")
    return user


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "connector"


def _latest_version(plugin) -> Optional["Any"]:
    """Newest published version (``versions`` is ordered released_at desc)."""
    return plugin.versions[0] if plugin.versions else None


def _version_dict(v) -> dict[str, Any]:
    return {
        "version": v.version,
        "download_url": v.download_url,
        "sha256": v.sha256,
        "changelog": v.changelog,
        "min_ide_version": v.min_ide_version,
        "released_at": v.released_at.isoformat() if v.released_at else None,
    }


def _plugin_summary(plugin, *, acquired: bool = False) -> dict[str, Any]:
    return {
        "slug": plugin.slug,
        "extension_id": plugin.extension_id,
        "name": plugin.name,
        "summary": plugin.summary,
        "publisher": plugin.publisher,
        "kind": plugin.kind,
        "category": plugin.category,
        "icon_url": plugin.icon_url,
        "latest_version": plugin.latest_version,
        "install_count": plugin.install_count,
        "acquired": acquired,
    }


def _plugin_detail(plugin, *, acquired: bool = False) -> dict[str, Any]:
    data = _plugin_summary(plugin, acquired=acquired)
    data.update(
        {
            "description": plugin.description,
            "homepage_url": plugin.homepage_url,
            "repo_url": plugin.repo_url,
            "source": plugin.source,
            "versions": [_version_dict(v) for v in plugin.versions],
        }
    )
    return data


# ─── Browse ───


@router.get("/plugins")
def list_plugins(
    q: str | None = Query(default=None, description="Free-text search"),
    kind: str | None = Query(default=None, description="plugin | connector"),
    category: str | None = None,
):
    """Browse the published catalog. Marks which entries are on the user's profile."""
    from sqlalchemy import or_, select

    from .models import Plugin, UserPlugin

    session_scope = _require_db()
    uid = get_current_user_id()
    with session_scope() as db:
        stmt = select(Plugin).where(Plugin.published.is_(True))
        if kind:
            stmt = stmt.where(Plugin.kind == kind)
        if category:
            stmt = stmt.where(Plugin.category == category)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Plugin.name.ilike(like),
                    Plugin.summary.ilike(like),
                    Plugin.publisher.ilike(like),
                )
            )
        stmt = stmt.order_by(Plugin.install_count.desc(), Plugin.name.asc())
        plugins = db.scalars(stmt).all()

        acquired_ids: set[str] = set()
        if uid:
            acquired_ids = {
                row.plugin_id
                for row in db.scalars(
                    select(UserPlugin).where(UserPlugin.user_id == uid)
                ).all()
            }
        return {
            "plugins": [
                _plugin_summary(p, acquired=p.id in acquired_ids) for p in plugins
            ]
        }


@router.get("/plugins/{slug}")
def plugin_detail(slug: str):
    from sqlalchemy import select

    from .models import Plugin, UserPlugin

    session_scope = _require_db()
    uid = get_current_user_id()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None or not plugin.published:
            raise HTTPException(status_code=404, detail="Plugin not found")
        acquired = False
        if uid:
            acquired = (
                db.scalar(
                    select(UserPlugin).where(
                        UserPlugin.user_id == uid, UserPlugin.plugin_id == plugin.id
                    )
                )
                is not None
            )
        return {"plugin": _plugin_detail(plugin, acquired=acquired)}


# ─── Profile ───


@router.get("/my")
def my_plugins():
    """Plugins the current user has added to their profile."""
    from sqlalchemy import select

    from .models import Plugin, UserPlugin

    session_scope = _require_db()
    uid = _require_user()
    with session_scope() as db:
        rows = db.scalars(
            select(UserPlugin)
            .where(UserPlugin.user_id == uid)
            .order_by(UserPlugin.acquired_at.desc())
        ).all()
        out = []
        for up in rows:
            plugin: "Plugin" = up.plugin
            entry = _plugin_summary(plugin, acquired=True)
            entry["pinned_version"] = up.pinned_version
            entry["acquired_at"] = up.acquired_at.isoformat() if up.acquired_at else None
            out.append(entry)
        return {"plugins": out}


class AcquireRequest(BaseModel):
    pinned_version: str | None = None


@router.post("/plugins/{slug}/acquire")
def acquire_plugin(slug: str, body: AcquireRequest | None = None):
    from sqlalchemy import select

    from .models import Plugin, UserPlugin

    session_scope = _require_db()
    uid = _require_user()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None or not plugin.published:
            raise HTTPException(status_code=404, detail="Plugin not found")
        existing = db.scalar(
            select(UserPlugin).where(
                UserPlugin.user_id == uid, UserPlugin.plugin_id == plugin.id
            )
        )
        if existing is None:
            db.add(
                UserPlugin(
                    user_id=uid,
                    plugin_id=plugin.id,
                    pinned_version=body.pinned_version if body else None,
                )
            )
            plugin.install_count = (plugin.install_count or 0) + 1
        elif body and body.pinned_version is not None:
            existing.pinned_version = body.pinned_version or None
        return {"ok": True, "acquired": True}


@router.delete("/plugins/{slug}/acquire")
def release_plugin(slug: str):
    from sqlalchemy import select

    from .models import Plugin, UserPlugin

    session_scope = _require_db()
    uid = _require_user()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None:
            raise HTTPException(status_code=404, detail="Plugin not found")
        existing = db.scalar(
            select(UserPlugin).where(
                UserPlugin.user_id == uid, UserPlugin.plugin_id == plugin.id
            )
        )
        if existing is not None:
            db.delete(existing)
            if plugin.install_count and plugin.install_count > 0:
                plugin.install_count -= 1
        return {"ok": True, "acquired": False}


# ─── Publish / review workflow ───


def _submission_dict(plugin) -> dict[str, Any]:
    latest = _latest_version(plugin)
    submitter = plugin.submitter
    return {
        "slug": plugin.slug,
        "extension_id": plugin.extension_id,
        "name": plugin.name,
        "summary": plugin.summary,
        "description": plugin.description,
        "kind": plugin.kind,
        "category": plugin.category,
        "status": plugin.status,
        "version": plugin.latest_version or (latest.version if latest else None),
        "download_url": latest.download_url if latest else None,
        "homepage_url": plugin.homepage_url,
        "repo_url": plugin.repo_url,
        "purpose": plugin.purpose,
        "input_schema": plugin.input_schema,
        "output_schema": plugin.output_schema,
        "review_notes": plugin.review_notes,
        "reviewed_by": plugin.reviewed_by,
        "reviewed_at": plugin.reviewed_at.isoformat() if plugin.reviewed_at else None,
        "submitter_name": submitter.name if submitter else None,
        "submitter_email": submitter.email if submitter else None,
        "created_at": plugin.created_at.isoformat() if plugin.created_at else None,
    }


class PublishRequest(BaseModel):
    name: str
    extension_id: str
    download_url: str | None = None
    version: str = "0.1.0"
    kind: str = "connector"
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    homepage_url: str | None = None
    repo_url: str | None = None
    source: str = "url"
    purpose: str | None = None
    input_schema: str | None = None
    output_schema: str | None = None


def _review_base_url(request: Request) -> str:
    if settings.api_base_url:
        return settings.api_base_url
    return str(request.base_url).rstrip("/")


def _create_submission(
    *,
    uid: str,
    request: Request,
    name: str,
    extension_id: str,
    version: str,
    download_url: str,
    sha256: str | None,
    kind: str,
    summary: str | None,
    description: str | None,
    category: str | None,
    homepage_url: str | None,
    repo_url: str | None,
    source: str,
    purpose: str | None,
    input_schema: str | None,
    output_schema: str | None,
    plugin_id: str | None = None,
) -> dict[str, Any]:
    from sqlalchemy import select

    from .models import Plugin, PluginVersion

    session_scope = _require_db()
    with session_scope() as db:
        if db.scalar(select(Plugin).where(Plugin.extension_id == extension_id)) is not None:
            raise HTTPException(status_code=409, detail=f"A listing for '{extension_id}' already exists")

        base_slug = _slugify(name)
        slug = base_slug
        suffix = 2
        while db.scalar(select(Plugin).where(Plugin.slug == slug)) is not None:
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        plugin_kwargs: dict[str, Any] = {
            "slug": slug,
            "extension_id": extension_id,
            "name": name,
            "summary": summary,
            "description": description,
            "publisher": (get_user_by_id(uid) or {}).get("name") or "community",
            "kind": kind,
            "category": category,
            "homepage_url": homepage_url,
            "repo_url": repo_url,
            "source": source,
            "latest_version": version,
            "published": False,
            "status": "pending",
            "submitted_by": uid,
            "purpose": purpose,
            "input_schema": input_schema,
            "output_schema": output_schema,
        }
        plugin = Plugin(id=plugin_id, **plugin_kwargs) if plugin_id else Plugin(**plugin_kwargs)
        db.add(plugin)
        db.flush()
        db.add(
            PluginVersion(
                plugin_id=plugin.id,
                version=version,
                download_url=download_url,
                sha256=sha256,
                changelog="Initial submission.",
                released_at=datetime.now(timezone.utc),
            )
        )
        db.flush()
        plugin_id = plugin.id
        payload = _submission_dict(plugin)

    _notify_new_submission(plugin_id, payload, request)
    return payload


@router.get("/artifacts/{plugin_id}/{filename}")
def download_artifact(plugin_id: str, filename: str):
    """Serve an uploaded .vsix artifact (public — used by the desktop sync client)."""
    if not filename.lower().endswith(".vsix"):
        raise HTTPException(status_code=404, detail="Artifact not found")
    version = filename[: -len(".vsix")]
    path = resolve_artifact_file(plugin_id, version)
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=path.name,
    )


@router.post("/publish")
def publish_plugin(req: PublishRequest, request: Request):
    """Submit a connector for review using a public download URL."""
    uid = _require_user()
    name = req.name.strip()
    extension_id = req.extension_id.strip()
    if not name or not extension_id:
        raise HTTPException(status_code=422, detail="name and extension_id are required")
    if not (req.download_url and req.download_url.strip()):
        raise HTTPException(
            status_code=422,
            detail="download_url is required — upload a .vsix via POST /api/marketplace/publish/upload instead",
        )
    if req.kind not in ("plugin", "connector"):
        raise HTTPException(status_code=422, detail="kind must be 'plugin' or 'connector'")

    payload = _create_submission(
        uid=uid,
        request=request,
        name=name,
        extension_id=extension_id,
        version=req.version,
        download_url=req.download_url.strip(),
        sha256=None,
        kind=req.kind,
        summary=req.summary,
        description=req.description,
        category=req.category,
        homepage_url=req.homepage_url,
        repo_url=req.repo_url,
        source=req.source,
        purpose=req.purpose,
        input_schema=req.input_schema,
        output_schema=req.output_schema,
    )
    return {"ok": True, "status": "pending", "submission": payload}


@router.post("/publish/upload")
async def publish_plugin_upload(
    request: Request,
    name: str = Form(...),
    extension_id: str = Form(...),
    version: str = Form("0.1.0"),
    kind: str = Form("connector"),
    summary: str | None = Form(None),
    description: str | None = Form(None),
    category: str | None = Form(None),
    homepage_url: str | None = Form(None),
    repo_url: str | None = Form(None),
    purpose: str | None = Form(None),
    input_schema: str | None = Form(None),
    output_schema: str | None = Form(None),
    artifact: UploadFile = File(...),
):
    """Submit a connector for review by uploading a .vsix artifact."""
    import uuid

    from sqlalchemy import select

    from .models import Plugin

    uid = _require_user()
    name = name.strip()
    extension_id = extension_id.strip()
    if not name or not extension_id:
        raise HTTPException(status_code=422, detail="name and extension_id are required")
    if kind not in ("plugin", "connector"):
        raise HTTPException(status_code=422, detail="kind must be 'plugin' or 'connector'")

    session_scope = _require_db()
    with session_scope() as db:
        if db.scalar(select(Plugin).where(Plugin.extension_id == extension_id)) is not None:
            raise HTTPException(status_code=409, detail=f"A listing for '{extension_id}' already exists")

    plugin_id = uuid.uuid4().hex
    _, sha256 = await save_vsix_upload(plugin_id, version, artifact)
    base = _review_base_url(request)
    download_url = artifact_download_url(base, plugin_id, version)

    payload = _create_submission(
        uid=uid,
        request=request,
        name=name,
        extension_id=extension_id,
        version=version,
        download_url=download_url,
        sha256=sha256,
        kind=kind,
        summary=summary,
        description=description,
        category=category,
        homepage_url=homepage_url,
        repo_url=repo_url,
        source="upload",
        purpose=purpose,
        input_schema=input_schema,
        output_schema=output_schema,
        plugin_id=plugin_id,
    )
    return {"ok": True, "status": "pending", "submission": payload}


def _notify_new_submission(plugin_id: str, payload: dict[str, Any], request: Request) -> None:
    """Email the reviewer mailbox with the submission details + action links."""
    from .notifications import send_email, submission_email

    base = _review_base_url(request)
    token = mint_review_token(plugin_id)
    approve_url = f"{base}/api/marketplace/review?token={token}&action=approve"
    reject_url = f"{base}/api/marketplace/review?token={token}&action=reject"
    email_payload = {
        "name": payload["name"],
        "kind": payload["kind"],
        "version": payload["version"],
        "extension_id": payload["extension_id"],
        "download_url": payload["download_url"],
        "summary": payload["summary"],
        "description": payload["description"],
        "purpose": payload["purpose"],
        "input_schema": payload["input_schema"],
        "output_schema": payload["output_schema"],
        "submitter_name": payload["submitter_name"] or "Unknown",
        "submitter_email": payload["submitter_email"] or "unknown",
    }
    subject, text, html = submission_email(email_payload, approve_url, reject_url)
    send_email(settings.review_email, subject, text, html)


@router.get("/my/submissions")
def my_submissions():
    """The current user's submissions and their review status."""
    from sqlalchemy import select

    from .models import Plugin

    session_scope = _require_db()
    uid = _require_user()
    with session_scope() as db:
        rows = db.scalars(
            select(Plugin)
            .where(Plugin.submitted_by == uid)
            .order_by(Plugin.created_at.desc())
        ).all()
        return {"submissions": [_submission_dict(p) for p in rows]}


@router.get("/submissions")
def list_submissions(status: str = Query(default="pending")):
    """Reviewer-only: list submissions awaiting (or filtered by) a decision."""
    from sqlalchemy import select

    from .models import Plugin

    session_scope = _require_db()
    _require_admin()
    with session_scope() as db:
        stmt = select(Plugin)
        if status != "all":
            stmt = stmt.where(Plugin.status == status)
        stmt = stmt.order_by(Plugin.created_at.desc())
        rows = db.scalars(stmt).all()
        return {"submissions": [_submission_dict(p) for p in rows]}


class ReviewDecision(BaseModel):
    notes: str | None = None


class E2eReviewTokenRequest(BaseModel):
    slug: str


@router.post("/e2e/review-token")
def e2e_review_token(body: E2eReviewTokenRequest, request: Request):
    """Test-only: mint approve/reject links for a pending submission (``LANGSTITCH_E2E_AUTH=true``)."""
    from sqlalchemy import select

    from .models import Plugin

    if not settings.e2e_auth_enabled or not settings.auth_enabled:
        raise HTTPException(status_code=404, detail="E2E review tokens are disabled")
    _require_admin()
    slug = body.slug.strip()
    if not slug:
        raise HTTPException(status_code=422, detail="slug is required")
    session_scope = _require_db()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        plugin_id = plugin.id
    base = _review_base_url(request)
    token = mint_review_token(plugin_id)
    return {
        "token": token,
        "approve_url": f"{base}/api/marketplace/review?token={token}&action=approve",
        "reject_url": f"{base}/api/marketplace/review?token={token}&action=reject",
    }


def _apply_decision(db, plugin, *, approved: bool, reviewer: str, notes: str | None) -> None:
    plugin.status = "approved" if approved else "rejected"
    plugin.published = approved
    plugin.review_notes = notes
    plugin.reviewed_by = reviewer
    plugin.reviewed_at = datetime.now(timezone.utc)


def _send_decision_email(plugin_dict: dict[str, Any], approved: bool, notes: str | None) -> None:
    if not plugin_dict.get("submitter_email"):
        return
    from .notifications import decision_email, send_email

    subject, text, html = decision_email(
        plugin_dict["submitter_email"], plugin_dict["name"], approved, notes
    )
    send_email(plugin_dict["submitter_email"], subject, text, html)


@router.post("/submissions/{slug}/approve")
def approve_submission(slug: str, body: ReviewDecision | None = None):
    from sqlalchemy import select

    from .models import Plugin

    session_scope = _require_db()
    admin = _require_admin()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        _apply_decision(
            db, plugin, approved=True, reviewer=admin.get("email") or "reviewer",
            notes=body.notes if body else None,
        )
        payload = _submission_dict(plugin)
    _send_decision_email(payload, True, payload["review_notes"])
    return {"ok": True, "status": "approved", "submission": payload}


@router.post("/submissions/{slug}/reject")
def reject_submission(slug: str, body: ReviewDecision | None = None):
    from sqlalchemy import select

    from .models import Plugin

    session_scope = _require_db()
    admin = _require_admin()
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.slug == slug))
        if plugin is None:
            raise HTTPException(status_code=404, detail="Submission not found")
        _apply_decision(
            db, plugin, approved=False, reviewer=admin.get("email") or "reviewer",
            notes=body.notes if body else None,
        )
        payload = _submission_dict(plugin)
    _send_decision_email(payload, False, payload["review_notes"])
    return {"ok": True, "status": "rejected", "submission": payload}


def _review_result_page(title: str, message: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:system-ui,sans-serif;background:#0b0d12;color:#e6e8ee;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}}
.card{{background:#14171f;border:1px solid #242a36;border-radius:14px;padding:32px 40px;text-align:center;max-width:440px}}
h1{{font-size:18px;margin:0 0 8px}}p{{color:#9aa3b2;font-size:14px;margin:0;line-height:1.5}}</style></head>
<body><div class="card"><h1>{title}</h1><p>{message}</p></div></body></html>"""


@router.get("/review", response_class=HTMLResponse)
def review_via_link(token: str, action: str):
    """Approve/reject from the link in the reviewer email (token authorizes the action)."""
    from sqlalchemy import select

    from .models import Plugin

    if action not in ("approve", "reject"):
        return HTMLResponse(_review_result_page("Invalid action", "Unknown review action."), status_code=400)
    plugin_id = verify_review_token(token)
    if not plugin_id:
        return HTMLResponse(
            _review_result_page("Link expired", "This review link is invalid or has expired."),
            status_code=400,
        )
    session_scope = _require_db()
    approved = action == "approve"
    with session_scope() as db:
        plugin = db.scalar(select(Plugin).where(Plugin.id == plugin_id))
        if plugin is None:
            return HTMLResponse(
                _review_result_page("Not found", "That submission no longer exists."),
                status_code=404,
            )
        if plugin.status != "pending":
            return HTMLResponse(
                _review_result_page(
                    "Already reviewed",
                    f"\"{plugin.name}\" was already {plugin.status}.",
                )
            )
        _apply_decision(db, plugin, approved=approved, reviewer=settings.review_email, notes=None)
        payload = _submission_dict(plugin)
    _send_decision_email(payload, approved, None)
    verb = "approved and published" if approved else "rejected"
    return HTMLResponse(
        _review_result_page("Done", f"\"{payload['name']}\" has been {verb}.")
    )


# ─── Desktop sync ───


@router.get("/sync")
def sync_manifest():
    """Install/update manifest for the desktop IDE.

    For each acquired plugin, returns the target version (pinned or latest) and
    its download URL so the client can reconcile what is installed locally.
    """
    from sqlalchemy import select

    from .models import Plugin, PluginVersion, UserPlugin

    session_scope = _require_db()
    uid = _require_user()
    with session_scope() as db:
        rows = db.scalars(
            select(UserPlugin).where(UserPlugin.user_id == uid)
        ).all()
        items: list[dict[str, Any]] = []
        for up in rows:
            plugin: "Plugin" = up.plugin
            if not plugin.published:
                continue
            target = None
            if up.pinned_version:
                target = db.scalar(
                    select(PluginVersion).where(
                        PluginVersion.plugin_id == plugin.id,
                        PluginVersion.version == up.pinned_version,
                    )
                )
            if target is None:
                target = _latest_version(plugin)
            if target is None:
                continue
            items.append(
                {
                    "slug": plugin.slug,
                    "extension_id": plugin.extension_id,
                    "name": plugin.name,
                    "kind": plugin.kind,
                    "source": plugin.source,
                    "pinned": bool(up.pinned_version),
                    "target_version": target.version,
                    "download_url": target.download_url,
                    "sha256": target.sha256,
                    "min_ide_version": target.min_ide_version,
                }
            )
        return {"plugins": items, "count": len(items)}


# ─── Seeding ───

_SEED_PLUGINS: list[dict[str, Any]] = [
    {
        "slug": "langtailor-canvas",
        "extension_id": "langstitch.langtailor-canvas",
        "name": "LangTailor Canvas",
        "summary": "Visual LangGraph canvas — design agent workflows and export Python.",
        "description": (
            "The built-in LangStitch visual canvas: a drag-and-drop editor for "
            "`*.langstitch.json` graphs with Python 3.13 multi-module export."
        ),
        "publisher": "langstitch",
        "kind": "plugin",
        "category": "Visualization",
        "source": "openvsx",
        "homepage_url": "https://langtailor.langstitch.com",
        "repo_url": "https://github.com/vijayptiwari/LangStitch",
        "icon_url": None,
        "versions": [
            {
                "version": "0.1.2",
                "download_url": "https://open-vsx.org/api/langstitch/langtailor-canvas/0.1.2/file/langstitch.langtailor-canvas-0.1.2.vsix",
                "min_ide_version": "0.1.0",
                "changelog": "Custom editor for *.langstitch.json with doc sync.",
            }
        ],
    },
    {
        "slug": "openai-connector",
        "extension_id": "langstitch.connector-openai",
        "name": "OpenAI Connector",
        "summary": "Wire OpenAI models and tools into your LangGraph nodes.",
        "description": "Connector exposing OpenAI chat/embedding models to LLM and RAG nodes.",
        "publisher": "langstitch",
        "kind": "connector",
        "category": "Models",
        "source": "url",
        "homepage_url": "https://langstitch.com/docs/",
        "versions": [
            {
                "version": "1.0.0",
                "download_url": "https://downloads.langstitch.com/connectors/openai/langstitch.connector-openai-1.0.0.vsix",
                "min_ide_version": "0.1.0",
                "changelog": "Initial release.",
            }
        ],
    },
    {
        "slug": "postgres-connector",
        "extension_id": "langstitch.connector-postgres",
        "name": "Postgres Connector",
        "summary": "Vector + relational retrieval from PostgreSQL / pgvector.",
        "description": "Connector for Postgres-backed RAG pipelines and checkpointers.",
        "publisher": "langstitch",
        "kind": "connector",
        "category": "Data",
        "source": "url",
        "versions": [
            {
                "version": "0.9.0",
                "download_url": "https://downloads.langstitch.com/connectors/postgres/langstitch.connector-postgres-0.9.0.vsix",
                "min_ide_version": "0.1.0",
            }
        ],
    },
]


def seed_marketplace(force: bool = False) -> int:
    """Insert the default catalog if it is empty. Returns rows inserted.

    Idempotent: skips plugins whose slug already exists unless ``force`` updates
    metadata. Safe to call on every startup.
    """
    from datetime import datetime, timezone

    from sqlalchemy import select

    from .db import session_scope
    from .models import Plugin, PluginVersion

    inserted = 0
    with session_scope() as db:
        for spec in _SEED_PLUGINS:
            plugin = db.scalar(select(Plugin).where(Plugin.slug == spec["slug"]))
            versions = spec.get("versions", [])
            latest = versions[0]["version"] if versions else None
            if plugin is None:
                plugin = Plugin(
                    slug=spec["slug"],
                    extension_id=spec["extension_id"],
                    name=spec["name"],
                    summary=spec.get("summary"),
                    description=spec.get("description"),
                    publisher=spec.get("publisher", "langstitch"),
                    kind=spec.get("kind", "plugin"),
                    category=spec.get("category"),
                    icon_url=spec.get("icon_url"),
                    homepage_url=spec.get("homepage_url"),
                    repo_url=spec.get("repo_url"),
                    source=spec.get("source", "openvsx"),
                    latest_version=latest,
                )
                db.add(plugin)
                db.flush()
                for v in versions:
                    db.add(
                        PluginVersion(
                            plugin_id=plugin.id,
                            version=v["version"],
                            download_url=v["download_url"],
                            sha256=v.get("sha256"),
                            changelog=v.get("changelog"),
                            min_ide_version=v.get("min_ide_version"),
                            released_at=datetime.now(timezone.utc),
                        )
                    )
                inserted += 1
    return inserted
