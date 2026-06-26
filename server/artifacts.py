"""Storage and serving helpers for uploaded marketplace .vsix artifacts."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from fastapi import HTTPException, UploadFile

from .config import settings

_SAFE_SEGMENT = re.compile(r"[^a-zA-Z0-9._-]+")


def artifacts_root() -> Path:
    root = Path(settings.artifacts_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_segment(value: str) -> str:
    cleaned = _SAFE_SEGMENT.sub("_", value.strip())
    return cleaned or "artifact"


def artifact_path(plugin_id: str, version: str) -> Path:
    return artifacts_root() / _safe_segment(plugin_id) / f"{_safe_segment(version)}.vsix"


def artifact_download_url(request_base: str, plugin_id: str, version: str) -> str:
    base = request_base.rstrip("/")
    pid = _safe_segment(plugin_id)
    ver = _safe_segment(version)
    return f"{base}/api/marketplace/artifacts/{pid}/{ver}.vsix"


async def save_vsix_upload(plugin_id: str, version: str, upload: UploadFile) -> tuple[Path, str]:
    """Persist an uploaded .vsix; return (path, sha256 hex)."""
    filename = (upload.filename or "").lower()
    if not filename.endswith(".vsix"):
        raise HTTPException(status_code=422, detail="Artifact must be a .vsix file")

    dest = artifact_path(plugin_id, version)
    dest.parent.mkdir(parents=True, exist_ok=True)

    hasher = hashlib.sha256()
    size = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_vsix_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"VSIX exceeds maximum size ({settings.max_vsix_bytes // (1024 * 1024)} MB)",
                    )
                hasher.update(chunk)
                out.write(chunk)
    except Exception:
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise

    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Uploaded VSIX file is empty")

    return dest, hasher.hexdigest()


def resolve_artifact_file(plugin_id: str, version: str) -> Path:
    """Return the on-disk path for a stored artifact, or 404."""
    path = artifact_path(plugin_id, version)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return path
