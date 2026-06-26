"""ORM models for users, linked OAuth accounts, per-user projects, and the
plugin/connector marketplace (catalog, versions, and per-user acquisitions)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    accounts: Mapped[list["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_provider_subject"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    subject: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="accounts")


class Project(Base):
    """Per-user registry of workspace projects (the canvas state lives on disk)."""

    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("user_id", "slug", name="uq_user_slug"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="projects")


# ─── Plugin / connector marketplace ───


class Plugin(Base):
    """A marketplace listing for a plugin or connector.

    The downloadable artifact is a VS Code-compatible extension (VSIX). We store
    the catalog metadata here; the actual artifacts live behind ``download_url``
    on each :class:`PluginVersion` (Open VSX, a GitHub Release asset, or any
    static host). ``extension_id`` is the canonical ``publisher.name`` id used by
    the IDE so the desktop client can tell what is already installed.
    """

    __tablename__ = "plugins"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    extension_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    publisher: Mapped[str] = mapped_column(String(160), default="langstitch")
    # "plugin" | "connector"
    kind: Mapped[str] = mapped_column(String(32), default="plugin", index=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    icon_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    homepage_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    repo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Where the artifact ultimately comes from: "openvsx" | "url"
    source: Mapped[str] = mapped_column(String(32), default="openvsx")
    # Denormalised pointer to the newest version string for quick listing.
    latest_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    published: Mapped[bool] = mapped_column(default=True, index=True)

    # ─── Submission / review workflow ───
    # "approved" | "pending" | "rejected". Seeded catalog is "approved".
    status: Mapped[str] = mapped_column(String(16), default="approved", index=True)
    submitted_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Free-form (or JSON) fields collected from the publisher at submit time.
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_schema: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_schema: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(320), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    submitter: Mapped["User | None"] = relationship("User", foreign_keys=[submitted_by])

    versions: Mapped[list["PluginVersion"]] = relationship(
        back_populates="plugin",
        cascade="all, delete-orphan",
        order_by="PluginVersion.released_at.desc()",
    )
    acquisitions: Mapped[list["UserPlugin"]] = relationship(
        back_populates="plugin", cascade="all, delete-orphan"
    )


class PluginVersion(Base):
    """A single released version of a plugin/connector."""

    __tablename__ = "plugin_versions"
    __table_args__ = (
        UniqueConstraint("plugin_id", "version", name="uq_plugin_version"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    plugin_id: Mapped[str] = mapped_column(
        ForeignKey("plugins.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[str] = mapped_column(String(64), index=True)
    download_url: Mapped[str] = mapped_column(String(1024))
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Minimum compatible IDE (LangTailor) version, e.g. "0.1.0".
    min_ide_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    released_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    plugin: Mapped["Plugin"] = relationship(back_populates="versions")


class UserPlugin(Base):
    """A plugin a user has added to their profile ("acquired").

    ``pinned_version`` lets a user stay on a specific version; when ``None`` the
    desktop client tracks the plugin's latest published version.
    """

    __tablename__ = "user_plugins"
    __table_args__ = (
        UniqueConstraint("user_id", "plugin_id", name="uq_user_plugin"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    plugin_id: Mapped[str] = mapped_column(
        ForeignKey("plugins.id", ondelete="CASCADE"), index=True
    )
    pinned_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    plugin: Mapped["Plugin"] = relationship(back_populates="acquisitions")
