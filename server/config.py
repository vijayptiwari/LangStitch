"""Central configuration for the LangStitch platform API.

All settings come from environment variables so the same image runs in dev,
Docker, and production. Authentication is OFF by default — when disabled the
platform behaves exactly as before (single shared workspace, no login), which
keeps the static GitHub Pages demo and local dev working with zero setup.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_database_url() -> str:
    """Return the SQLAlchemy URL, assembling from MYSQL_* parts if needed."""
    explicit = os.environ.get("LANGSTITCH_DATABASE_URL")
    if explicit:
        return explicit
    host = os.environ.get("MYSQL_HOST")
    if not host:
        return ""
    user = os.environ.get("MYSQL_USER", "root")
    password = os.environ.get("MYSQL_PASSWORD", "")
    port = os.environ.get("MYSQL_PORT", "3306")
    database = os.environ.get("MYSQL_DATABASE", "langstitch")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    client_id: str
    client_secret: str
    server_metadata_url: str
    scope: str

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


def _providers() -> dict[str, ProviderConfig]:
    tenant = os.environ.get("MICROSOFT_TENANT_ID", "common")
    return {
        "google": ProviderConfig(
            name="google",
            client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
            client_secret=os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            scope="openid email profile",
        ),
        "microsoft": ProviderConfig(
            name="microsoft",
            client_id=os.environ.get("MICROSOFT_CLIENT_ID", ""),
            client_secret=os.environ.get("MICROSOFT_CLIENT_SECRET", ""),
            server_metadata_url=(
                f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"
            ),
            scope="openid email profile",
        ),
        "linkedin": ProviderConfig(
            name="linkedin",
            client_id=os.environ.get("LINKEDIN_CLIENT_ID", ""),
            client_secret=os.environ.get("LINKEDIN_CLIENT_SECRET", ""),
            server_metadata_url="https://www.linkedin.com/oauth/.well-known/openid-configuration",
            scope="openid profile email",
        ),
    }


@dataclass(frozen=True)
class Settings:
    auth_enabled: bool = field(default_factory=lambda: _flag("LANGSTITCH_AUTH_ENABLED", False))
    session_secret: str = field(
        default_factory=lambda: os.environ.get(
            "LANGSTITCH_SESSION_SECRET", "dev-insecure-secret-change-me"
        )
    )
    cookie_secure: bool = field(default_factory=lambda: _flag("LANGSTITCH_COOKIE_SECURE", False))
    cookie_same_site: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_COOKIE_SAMESITE", "lax")
    )
    session_max_age: int = field(
        default_factory=lambda: int(os.environ.get("LANGSTITCH_SESSION_MAX_AGE", str(60 * 60 * 24 * 7)))
    )
    database_url: str = field(default_factory=_build_database_url)
    # Where to send the browser after a successful / failed login.
    frontend_url: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_FRONTEND_URL", "http://localhost:5173")
    )
    # Public base URL of THIS api, used to build OAuth redirect URIs.
    # Empty -> derive from the incoming request.
    api_base_url: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_API_BASE_URL", "").rstrip("/")
    )
    providers: dict[str, ProviderConfig] = field(default_factory=_providers)

    @property
    def enabled_providers(self) -> list[str]:
        return [name for name, p in self.providers.items() if p.configured]


settings = Settings()
