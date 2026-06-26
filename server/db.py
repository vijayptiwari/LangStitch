"""SQLAlchemy engine + session management for the platform API.

The engine is created lazily so the server still imports and runs when auth is
disabled or the DB driver isn't installed. Call ``init_db()`` on startup (only
when auth is enabled) to create tables.
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import settings

_engine = None
_SessionLocal = None


class DatabaseNotConfigured(RuntimeError):
    pass


def _ensure_engine():
    global _engine, _SessionLocal
    if _SessionLocal is not None:
        return _SessionLocal
    if not settings.database_url:
        raise DatabaseNotConfigured(
            "No database configured. Set LANGSTITCH_DATABASE_URL or MYSQL_* env vars."
        )
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    _engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=3600,
        future=True,
    )
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    return _SessionLocal


def init_db() -> None:
    """Create tables. Safe to call repeatedly."""
    from .models import Base  # imported here to avoid import cycles

    session_factory = _ensure_engine()
    Base.metadata.create_all(bind=session_factory.kw["bind"])


def run_migrations() -> None:
    """Apply Alembic migrations when a database URL is configured."""
    if not settings.database_url:
        return
    ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    if not ini.is_file():
        return
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config(str(ini)), "head")


@contextmanager
def session_scope() -> Iterator["object"]:
    """Transactional scope around a series of operations."""
    session_factory = _ensure_engine()
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
