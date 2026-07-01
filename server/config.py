"""Central configuration for the LangStitch platform API.

All settings come from environment variables so the same image runs in dev,
Docker, and production. Authentication is OFF by default — when disabled the
platform behaves exactly as before (single shared workspace, no login), which
keeps local dev and extension-backed workflows working with zero setup.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv() -> None:
    """Load secrets from a local ``.env`` file so a bare ``uvicorn`` launch works.

    Secrets (DB password, session secret, OAuth/SMTP keys) live in a git-ignored
    ``.env`` at the repo root and are read into the process environment here.
    Real environment variables always win, so Docker/systemd/CI overrides are not
    clobbered. Missing ``.env`` or missing ``python-dotenv`` is a silent no-op.
    """
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.is_file():
        load_dotenv(env_path, override=False)


_load_dotenv()


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
    from urllib.parse import quote_plus

    # Encode user/password so special characters (e.g. '@', ':', '/') in the
    # credentials don't corrupt the URL's authority section.
    user = quote_plus(os.environ.get("MYSQL_USER", "root"))
    password = quote_plus(os.environ.get("MYSQL_PASSWORD", ""))
    port = os.environ.get("MYSQL_PORT", "3306")
    database = os.environ.get("MYSQL_DATABASE", "langstitch")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    client_id: str
    client_secret: str
    scope: str
    # OIDC providers expose a discovery document; plain OAuth2 providers
    # (e.g. GitHub) instead declare explicit endpoints.
    server_metadata_url: str = ""
    authorize_url: str = ""
    access_token_url: str = ""
    api_base_url: str = ""
    userinfo_endpoint: str = ""

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    @property
    def is_oidc(self) -> bool:
        return bool(self.server_metadata_url)


def _providers() -> dict[str, ProviderConfig]:
    tenant = os.environ.get("MICROSOFT_TENANT_ID", "common")
    return {
        "github": ProviderConfig(
            name="github",
            client_id=os.environ.get("GITHUB_CLIENT_ID", ""),
            client_secret=os.environ.get("GITHUB_CLIENT_SECRET", ""),
            scope="read:user user:email",
            authorize_url="https://github.com/login/oauth/authorize",
            access_token_url="https://github.com/login/oauth/access_token",
            api_base_url="https://api.github.com/",
            userinfo_endpoint="https://api.github.com/user",
        ),
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


def _admin_emails() -> frozenset[str]:
    raw = os.environ.get("LANGSTITCH_ADMIN_EMAILS", "dev@langstitch.com")
    return frozenset(e.strip().lower() for e in raw.split(",") if e.strip())


def _smtp_settings() -> dict[str, str | int | bool]:
    """Resolve SMTP host/port/credentials from explicit env or a named provider preset.

    Presets (set ``LANGSTITCH_SMTP_PROVIDER``):
      - ``sendgrid`` — smtp.sendgrid.net:587, user ``apikey``, password from
        ``SENDGRID_API_KEY`` or ``LANGSTITCH_SMTP_PASSWORD``
      - ``gmail`` — smtp.gmail.com:587 (app password in ``LANGSTITCH_SMTP_PASSWORD``)
      - ``mailgun`` — smtp.mailgun.org:587
      - ``custom`` / unset — use ``LANGSTITCH_SMTP_*`` as-is
    """
    provider = os.environ.get("LANGSTITCH_SMTP_PROVIDER", "custom").strip().lower()
    host = os.environ.get("LANGSTITCH_SMTP_HOST", "")
    port = int(os.environ.get("LANGSTITCH_SMTP_PORT", "587"))
    user = os.environ.get("LANGSTITCH_SMTP_USER", "")
    password = os.environ.get("LANGSTITCH_SMTP_PASSWORD", "")
    use_tls = _flag("LANGSTITCH_SMTP_USE_TLS", True)
    use_ssl = _flag("LANGSTITCH_SMTP_USE_SSL", False)
    from_addr = os.environ.get(
        "LANGSTITCH_SMTP_FROM", "LangStitch Marketplace <no-reply@langstitch.com>"
    )

    if provider == "sendgrid":
        host = host or "smtp.sendgrid.net"
        port = port if os.environ.get("LANGSTITCH_SMTP_PORT") else 587
        user = user or "apikey"
        password = password or os.environ.get("SENDGRID_API_KEY", "")
        use_tls = True
        use_ssl = False
    elif provider == "gmail":
        host = host or "smtp.gmail.com"
        port = port if os.environ.get("LANGSTITCH_SMTP_PORT") else 587
        use_tls = True
        use_ssl = False
    elif provider == "mailgun":
        host = host or "smtp.mailgun.org"
        port = port if os.environ.get("LANGSTITCH_SMTP_PORT") else 587
        use_tls = True
        use_ssl = False
    elif provider == "ses":
        # Amazon SES SMTP — set LANGSTITCH_SMTP_HOST to your region endpoint.
        host = host or "email-smtp.us-east-1.amazonaws.com"
        port = port if os.environ.get("LANGSTITCH_SMTP_PORT") else 587
        use_tls = True
        use_ssl = False

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "from_addr": from_addr,
    }


@dataclass(frozen=True)
class Settings:
    auth_enabled: bool = field(default_factory=lambda: _flag("LANGSTITCH_AUTH_ENABLED", False))
    e2e_auth_enabled: bool = field(default_factory=lambda: _flag("LANGSTITCH_E2E_AUTH", False))
    session_secret: str = field(
        default_factory=lambda: os.environ.get(
            "LANGSTITCH_SESSION_SECRET", "dev-insecure-secret-change-me"
        )
    )
    cookie_secure: bool = field(default_factory=lambda: _flag("LANGSTITCH_COOKIE_SECURE", False))
    cookie_same_site: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_COOKIE_SAMESITE", "lax")
    )
    # Cookie domain for the session. Set to a parent domain (e.g. ".langstitch.com")
    # so the login session is shared across the IDE and marketplace subdomains.
    cookie_domain: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_COOKIE_DOMAIN", "")
    )
    session_max_age: int = field(
        default_factory=lambda: int(os.environ.get("LANGSTITCH_SESSION_MAX_AGE", str(60 * 60 * 24 * 7)))
    )
    # Lifetime of bearer tokens minted for the desktop IDE (default 30 days).
    desktop_token_max_age: int = field(
        default_factory=lambda: int(
            os.environ.get("LANGSTITCH_DESKTOP_TOKEN_MAX_AGE", str(60 * 60 * 24 * 30))
        )
    )
    # Custom URL scheme the desktop IDE registers for deep-link auth callbacks.
    desktop_url_scheme: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_DESKTOP_URL_SCHEME", "langtailor")
    )
    database_url: str = field(default_factory=_build_database_url)
    # Where to send the browser after a successful / failed login.
    frontend_url: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_FRONTEND_URL", "http://localhost:5173")
    )
    # Public URL of the standalone marketplace site (e.g. https://marketplace.langstitch.com).
    # When set, it is allowed as a CORS origin and a post-login return target.
    marketplace_url: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_MARKETPLACE_URL", "").rstrip("/")
    )
    # Public base URL of THIS api, used to build OAuth redirect URIs.
    # Empty -> derive from the incoming request.
    api_base_url: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_API_BASE_URL", "").rstrip("/")
    )
    providers: dict[str, ProviderConfig] = field(default_factory=_providers)

    # ─── Marketplace review / email ───
    # Reviewers who can approve or reject submitted connectors.
    admin_emails: frozenset[str] = field(default_factory=_admin_emails)
    # Where new submission notifications are sent.
    review_email: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_REVIEW_EMAIL", "dev@langstitch.com")
    )
    # SMTP transport (optional). When unset, emails are logged instead of sent.
    smtp_host: str = field(default_factory=lambda: str(_smtp_settings()["host"]))
    smtp_port: int = field(default_factory=lambda: int(_smtp_settings()["port"]))
    smtp_user: str = field(default_factory=lambda: str(_smtp_settings()["user"]))
    smtp_password: str = field(default_factory=lambda: str(_smtp_settings()["password"]))
    smtp_use_tls: bool = field(default_factory=lambda: bool(_smtp_settings()["use_tls"]))
    smtp_use_ssl: bool = field(default_factory=lambda: bool(_smtp_settings()["use_ssl"]))
    smtp_from: str = field(default_factory=lambda: str(_smtp_settings()["from_addr"]))
    smtp_provider: str = field(
        default_factory=lambda: os.environ.get("LANGSTITCH_SMTP_PROVIDER", "custom")
    )
    # On-disk store for uploaded .vsix artifacts (served under /api/marketplace/artifacts/).
    artifacts_root: str = field(
        default_factory=lambda: os.environ.get(
            "LANGSTITCH_ARTIFACTS_ROOT",
            str(Path.home() / ".langstitch" / "artifacts"),
        )
    )
    # Max upload size for marketplace .vsix submissions (bytes).
    max_vsix_bytes: int = field(
        default_factory=lambda: int(
            os.environ.get("LANGSTITCH_MAX_VSIX_BYTES", str(50 * 1024 * 1024))
        )
    )

    @property
    def enabled_providers(self) -> list[str]:
        return [name for name, p in self.providers.items() if p.configured]

    @property
    def cors_origins(self) -> list[str]:
        """Browser origins allowed to call the API with credentials.

        Combines an explicit ``LANGSTITCH_CORS_ORIGINS`` list with the IDE
        (``frontend_url``) and marketplace (``marketplace_url``) sites.
        """
        explicit = os.environ.get("LANGSTITCH_CORS_ORIGINS", "")
        origins = [o.strip().rstrip("/") for o in explicit.split(",") if o.strip()]
        for url in (self.frontend_url, self.marketplace_url):
            normalized = (url or "").rstrip("/")
            if normalized and normalized not in origins:
                origins.append(normalized)
        return origins

    def is_allowed_return_url(self, url: str) -> bool:
        """Whether ``url`` is a trusted post-login redirect target (origin match)."""
        if not url:
            return False
        try:
            from urllib.parse import urlparse

            parsed = urlparse(url)
        except ValueError:
            return False
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        allowed = {o.rstrip("/") for o in self.cors_origins}
        return origin in allowed

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host)

    def is_admin_email(self, email: str | None) -> bool:
        return bool(email) and email.strip().lower() in self.admin_emails


settings = Settings()
