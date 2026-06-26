"""Marketplace tables and submission/review columns.

Revision ID: 0001_marketplace
Revises:
Create Date: 2026-06-26

Safe on databases created earlier via ``init_db()`` / ``create_all``:
creates marketplace tables when missing and adds review columns to ``plugins``
when the table already exists without them.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0001_marketplace"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_REVIEW_COLUMNS = (
    ("status", sa.String(16), "approved"),
    ("submitted_by", sa.String(32), None),
    ("purpose", sa.Text(), None),
    ("input_schema", sa.Text(), None),
    ("output_schema", sa.Text(), None),
    ("review_notes", sa.Text(), None),
    ("reviewed_by", sa.String(320), None),
    ("reviewed_at", sa.DateTime(timezone=True), None),
)


def _has_table(name: str) -> bool:
    return name in inspect(op.get_bind()).get_table_names()


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if not _has_table("plugins"):
        op.create_table(
            "plugins",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("slug", sa.String(160), nullable=False),
            sa.Column("extension_id", sa.String(255), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("summary", sa.String(512), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("publisher", sa.String(160), nullable=False, server_default="langstitch"),
            sa.Column("kind", sa.String(32), nullable=False, server_default="plugin"),
            sa.Column("category", sa.String(120), nullable=True),
            sa.Column("icon_url", sa.String(1024), nullable=True),
            sa.Column("homepage_url", sa.String(1024), nullable=True),
            sa.Column("repo_url", sa.String(1024), nullable=True),
            sa.Column("source", sa.String(32), nullable=False, server_default="openvsx"),
            sa.Column("latest_version", sa.String(64), nullable=True),
            sa.Column("install_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("status", sa.String(16), nullable=False, server_default="approved"),
            sa.Column("submitted_by", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("purpose", sa.Text(), nullable=True),
            sa.Column("input_schema", sa.Text(), nullable=True),
            sa.Column("output_schema", sa.Text(), nullable=True),
            sa.Column("review_notes", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.String(320), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_plugins_slug", "plugins", ["slug"], unique=True)
        op.create_index("ix_plugins_extension_id", "plugins", ["extension_id"], unique=True)
        op.create_index("ix_plugins_kind", "plugins", ["kind"])
        op.create_index("ix_plugins_category", "plugins", ["category"])
        op.create_index("ix_plugins_published", "plugins", ["published"])
        op.create_index("ix_plugins_status", "plugins", ["status"])
        op.create_index("ix_plugins_submitted_by", "plugins", ["submitted_by"])
    else:
        for col_name, col_type, default in _REVIEW_COLUMNS:
            if not _has_column("plugins", col_name):
                kwargs: dict = {"nullable": True}
                if default is not None:
                    kwargs["server_default"] = default
                op.add_column("plugins", sa.Column(col_name, col_type, **kwargs))
        try:
            op.create_index("ix_plugins_status", "plugins", ["status"])
        except Exception:  # noqa: BLE001
            pass

    if not _has_table("plugin_versions"):
        op.create_table(
            "plugin_versions",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("plugin_id", sa.String(32), sa.ForeignKey("plugins.id", ondelete="CASCADE"), nullable=False),
            sa.Column("version", sa.String(64), nullable=False),
            sa.Column("download_url", sa.String(1024), nullable=False),
            sa.Column("sha256", sa.String(64), nullable=True),
            sa.Column("changelog", sa.Text(), nullable=True),
            sa.Column("min_ide_version", sa.String(64), nullable=True),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("plugin_id", "version", name="uq_plugin_version"),
        )
        op.create_index("ix_plugin_versions_plugin_id", "plugin_versions", ["plugin_id"])
        op.create_index("ix_plugin_versions_version", "plugin_versions", ["version"])

    if not _has_table("user_plugins"):
        op.create_table(
            "user_plugins",
            sa.Column("id", sa.String(32), primary_key=True),
            sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("plugin_id", sa.String(32), sa.ForeignKey("plugins.id", ondelete="CASCADE"), nullable=False),
            sa.Column("pinned_version", sa.String(64), nullable=True),
            sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "plugin_id", name="uq_user_plugin"),
        )
        op.create_index("ix_user_plugins_user_id", "user_plugins", ["user_id"])
        op.create_index("ix_user_plugins_plugin_id", "user_plugins", ["plugin_id"])


def downgrade() -> None:
    if _has_table("user_plugins"):
        op.drop_table("user_plugins")
    if _has_table("plugin_versions"):
        op.drop_table("plugin_versions")
    if _has_table("plugins"):
        for col_name, _, _ in reversed(_REVIEW_COLUMNS):
            if _has_column("plugins", col_name):
                op.drop_column("plugins", col_name)
