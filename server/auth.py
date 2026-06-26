"""OAuth (OpenID Connect) login for Google, Microsoft, and LinkedIn.

Flow (server-side, secure):
  1. Browser hits  GET /api/auth/login/{provider}
  2. We redirect to the provider's consent screen.
  3. Provider redirects back to GET /api/auth/callback/{provider}.
  4. We exchange the code, read the OIDC userinfo, upsert the user in MySQL,
     and store the user id in a signed, httpOnly session cookie.
  5. Browser is redirected back to the frontend.

A contextvar holds the current user's id for the duration of a request so the
workspace layer can scope files per user without threading the user through
every endpoint signature.
"""

from __future__ import annotations

import contextvars
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from starlette.requests import Request
from starlette.responses import RedirectResponse

from .config import settings

# Set by the ASGI auth middleware (see main.py) for each request.
_current_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user_id", default=None
)


def set_current_user_id(user_id: Optional[str]):
    return _current_user_id.set(user_id)


def reset_current_user_id(token) -> None:
    _current_user_id.reset(token)


def get_current_user_id() -> Optional[str]:
    return _current_user_id.get()


# ─── Authlib OAuth registry (lazy) ───

_oauth = None


def _get_oauth():
    global _oauth
    if _oauth is not None:
        return _oauth
    from authlib.integrations.starlette_client import OAuth

    oauth = OAuth()
    for name, provider in settings.providers.items():
        if not provider.configured:
            continue
        oauth.register(
            name=name,
            client_id=provider.client_id,
            client_secret=provider.client_secret,
            server_metadata_url=provider.server_metadata_url,
            client_kwargs={"scope": provider.scope},
        )
    _oauth = oauth
    return _oauth


def _redirect_uri(request: Request, provider: str) -> str:
    if settings.api_base_url:
        return f"{settings.api_base_url}/api/auth/callback/{provider}"
    return str(request.url_for("auth_callback", provider=provider))


# ─── User persistence ───


def _upsert_user(userinfo: dict[str, Any], provider: str) -> dict[str, Any]:
    """Create or update the user + linked oauth account; return a plain dict."""
    from sqlalchemy import select

    from .db import session_scope
    from .models import OAuthAccount, User

    subject = str(userinfo.get("sub") or userinfo.get("id") or "")
    email = userinfo.get("email")
    name = userinfo.get("name") or userinfo.get("given_name") or email
    avatar = userinfo.get("picture")
    if not subject:
        raise HTTPException(status_code=400, detail="Provider did not return a subject id")

    with session_scope() as db:
        account = db.scalar(
            select(OAuthAccount).where(
                OAuthAccount.provider == provider, OAuthAccount.subject == subject
            )
        )
        if account is not None:
            user = account.user
        else:
            user = None
            if email:
                user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, name=name, avatar_url=avatar)
                db.add(user)
                db.flush()
            account = OAuthAccount(
                user_id=user.id, provider=provider, subject=subject, email=email
            )
            db.add(account)

        # Refresh profile fields on each login.
        user.name = name or user.name
        user.avatar_url = avatar or user.avatar_url
        if email and not user.email:
            user.email = email
        from datetime import datetime, timezone

        user.last_login_at = datetime.now(timezone.utc)
        db.flush()
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
        }


def get_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    from .db import session_scope
    from .models import User

    with session_scope() as db:
        user = db.get(User, user_id)
        if user is None:
            return None
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
        }


# ─── Routes ───

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/context")
def auth_context(request: Request):
    """Tell the frontend whether auth is on, which providers exist, and who is logged in."""
    user = None
    if settings.auth_enabled:
        user_id = request.session.get("user_id")
        if user_id:
            try:
                user = get_user_by_id(user_id)
            except Exception:
                user = None
    return {
        "enabled": settings.auth_enabled,
        "providers": settings.enabled_providers if settings.auth_enabled else [],
        "user": user,
    }


@router.get("/me")
def me(request: Request):
    if not settings.auth_enabled:
        return {"user": None}
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_by_id(user_id)
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user}


@router.get("/login/{provider}")
async def auth_login(provider: str, request: Request):
    if not settings.auth_enabled:
        raise HTTPException(status_code=404, detail="Authentication is disabled")
    if provider not in settings.enabled_providers:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' is not configured")
    oauth = _get_oauth()
    client = oauth.create_client(provider)
    return await client.authorize_redirect(request, _redirect_uri(request, provider))


@router.get("/callback/{provider}", name="auth_callback")
async def auth_callback(provider: str, request: Request):
    if not settings.auth_enabled or provider not in settings.enabled_providers:
        raise HTTPException(status_code=404, detail="Authentication is disabled")
    oauth = _get_oauth()
    client = oauth.create_client(provider)
    try:
        token = await client.authorize_access_token(request)
    except Exception:  # noqa: BLE001 - surface a clean login failure to the UI
        return RedirectResponse(url=f"{settings.frontend_url}/?auth_error={provider}")

    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            userinfo = await client.userinfo(token=token)
        except Exception:
            userinfo = None
    if not userinfo:
        return RedirectResponse(url=f"{settings.frontend_url}/?auth_error={provider}")

    user = _upsert_user(dict(userinfo), provider)
    request.session["user_id"] = user["id"]
    return RedirectResponse(url=settings.frontend_url)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}
