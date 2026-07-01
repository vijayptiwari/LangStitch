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
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
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


# ─── Bearer tokens for the desktop IDE ───
#
# The browser-based flow keeps using signed, httpOnly session cookies. Native
# desktop clients (LangTailor) can't share that cookie, so after an OAuth login
# initiated by the desktop app we mint a signed, expiring bearer token that the
# IDE stores in its OS secret store and sends as ``Authorization: Bearer <tok>``.

_TOKEN_SALT = "langstitch-desktop-token"


def _token_serializer():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(settings.session_secret, salt=_TOKEN_SALT)


def mint_desktop_token(user_id: str) -> str:
    return _token_serializer().dumps({"uid": user_id})


def verify_desktop_token(token: str) -> Optional[str]:
    """Return the user id encoded in a valid, unexpired token, else ``None``."""
    from itsdangerous import BadData

    if not token:
        return None
    try:
        data = _token_serializer().loads(token, max_age=settings.desktop_token_max_age)
    except BadData:
        return None
    uid = data.get("uid") if isinstance(data, dict) else None
    return str(uid) if uid else None


_REVIEW_SALT = "langstitch-review-action"
_REVIEW_TOKEN_MAX_AGE = 60 * 60 * 24 * 14  # links in review emails last 14 days


def _review_serializer():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(settings.session_secret, salt=_REVIEW_SALT)


def mint_review_token(plugin_id: str) -> str:
    """Token embedded in approve/reject links sent to the reviewer mailbox."""
    return _review_serializer().dumps({"pid": plugin_id})


def verify_review_token(token: str) -> Optional[str]:
    from itsdangerous import BadData

    if not token:
        return None
    try:
        data = _review_serializer().loads(token, max_age=_REVIEW_TOKEN_MAX_AGE)
    except BadData:
        return None
    pid = data.get("pid") if isinstance(data, dict) else None
    return str(pid) if pid else None


def user_id_from_authorization(header: Optional[str]) -> Optional[str]:
    """Parse an ``Authorization: Bearer <token>`` header into a user id."""
    if not header:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return verify_desktop_token(value.strip())


def _is_allowed_desktop_redirect(uri: str) -> bool:
    """Only allow loopback http(s) URLs or the registered desktop URL scheme.

    This prevents the OAuth callback from being used as an open redirector.
    """
    try:
        parsed = urlparse(uri)
    except ValueError:
        return False
    if parsed.scheme == settings.desktop_url_scheme:
        return True
    if parsed.scheme in ("http", "https"):
        return (parsed.hostname or "") in ("127.0.0.1", "localhost", "::1")
    return False


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
        if provider.is_oidc:
            oauth.register(
                name=name,
                client_id=provider.client_id,
                client_secret=provider.client_secret,
                server_metadata_url=provider.server_metadata_url,
                client_kwargs={"scope": provider.scope},
            )
        else:
            # Plain OAuth2 (e.g. GitHub) with explicit endpoints.
            oauth.register(
                name=name,
                client_id=provider.client_id,
                client_secret=provider.client_secret,
                authorize_url=provider.authorize_url,
                access_token_url=provider.access_token_url,
                api_base_url=provider.api_base_url,
                userinfo_endpoint=provider.userinfo_endpoint,
                client_kwargs={
                    "scope": provider.scope,
                    "token_endpoint_auth_method": "client_secret_post",
                },
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
    name = (
        userinfo.get("name")
        or userinfo.get("given_name")
        or userinfo.get("login")  # GitHub username fallback
        or email
    )
    avatar = userinfo.get("picture") or userinfo.get("avatar_url")
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


def _resolve_request_user_id(request: Request) -> Optional[str]:
    """User id for this request from the session cookie or a bearer token."""
    user_id = request.session.get("user_id")
    if user_id:
        return str(user_id)
    return user_id_from_authorization(request.headers.get("Authorization"))


@router.get("/context")
def auth_context(request: Request):
    """Tell the frontend whether auth is on, which providers exist, and who is logged in."""
    user = None
    if settings.auth_enabled:
        user_id = _resolve_request_user_id(request)
        if user_id:
            try:
                user = get_user_by_id(user_id)
            except Exception:
                user = None
    return {
        "enabled": settings.auth_enabled,
        "providers": settings.enabled_providers if settings.auth_enabled else [],
        "user": user,
        "is_admin": bool(user and settings.is_admin_email(user.get("email"))),
    }


@router.get("/me")
def me(request: Request):
    if not settings.auth_enabled:
        return {"user": None}
    user_id = _resolve_request_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_user_by_id(user_id)
    if user is None:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user}


@router.get("/login/{provider}")
async def auth_login(
    provider: str,
    request: Request,
    redirect_uri: str | None = None,
    return_to: str | None = None,
):
    if not settings.auth_enabled:
        raise HTTPException(status_code=404, detail="Authentication is disabled")
    if provider not in settings.enabled_providers:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' is not configured")
    # A desktop client passes ?redirect_uri=<loopback or scheme URL> so we can
    # hand the bearer token back to the native app after consent.
    if redirect_uri:
        if not _is_allowed_desktop_redirect(redirect_uri):
            raise HTTPException(status_code=400, detail="Invalid redirect_uri")
        request.session["desktop_redirect"] = redirect_uri
    else:
        request.session.pop("desktop_redirect", None)
    # A web client (IDE or marketplace site) passes ?return_to=<its own URL> so
    # we send the browser back to the originating site after login.
    if return_to and settings.is_allowed_return_url(return_to):
        request.session["web_return_to"] = return_to
    else:
        request.session.pop("web_return_to", None)
    oauth = _get_oauth()
    client = oauth.create_client(provider)
    return await client.authorize_redirect(request, _redirect_uri(request, provider))


def _append_query(url: str, **params: str) -> str:
    from urllib.parse import urlencode

    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{urlencode(params)}"


@router.get("/callback/{provider}", name="auth_callback")
async def auth_callback(provider: str, request: Request):
    if not settings.auth_enabled or provider not in settings.enabled_providers:
        raise HTTPException(status_code=404, detail="Authentication is disabled")
    desktop_redirect = request.session.pop("desktop_redirect", None)
    web_return_to = request.session.pop("web_return_to", None)
    web_target = web_return_to if (web_return_to and settings.is_allowed_return_url(web_return_to)) else settings.frontend_url

    def _fail() -> RedirectResponse:
        if desktop_redirect:
            return RedirectResponse(url=_append_query(desktop_redirect, error=provider))
        return RedirectResponse(url=_append_query(web_target, auth_error=provider))

    oauth = _get_oauth()
    client = oauth.create_client(provider)
    try:
        token = await client.authorize_access_token(request)
    except Exception:  # noqa: BLE001 - surface a clean login failure to the UI
        return _fail()

    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            userinfo = await client.userinfo(token=token)
        except Exception:
            userinfo = None
    if not userinfo:
        return _fail()

    user = _upsert_user(dict(userinfo), provider)
    request.session["user_id"] = user["id"]

    if desktop_redirect:
        bearer = mint_desktop_token(user["id"])
        return RedirectResponse(url=_append_query(desktop_redirect, token=bearer))
    return RedirectResponse(url=web_target)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


class E2eLoginRequest(BaseModel):
    email: str
    name: str = "E2E User"


@router.post("/e2e/login")
def e2e_login(body: E2eLoginRequest, request: Request):
    """Test-only login for Playwright E2E (``LANGSTITCH_E2E_AUTH=true``).

    Upserts a user, sets the session cookie, and returns a bearer token so API
    tests can authenticate without OAuth redirects.
    """
    if not settings.e2e_auth_enabled or not settings.auth_enabled:
        raise HTTPException(status_code=404, detail="E2E auth is disabled")
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="email is required")
    user = _upsert_user(
        {"sub": email, "email": email, "name": body.name or email},
        "e2e",
    )
    request.session["user_id"] = user["id"]
    token = mint_desktop_token(user["id"])
    return {
        "user": user,
        "token": token,
        "is_admin": settings.is_admin_email(user.get("email")),
    }
