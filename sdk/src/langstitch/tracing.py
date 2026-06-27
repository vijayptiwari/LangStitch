"""LangSmith tracing, structured logging, and graph registration.

Reads the ``tracing`` section of ``application.yaml`` (and standard LangSmith
environment variables) to configure observability for LangStitch applications.

Typical usage::

    from langstitch.tracing import configure_tracing, register_graph, traced_invoke

    configure_tracing()  # once at startup (LangStitchApp.bootstrap does this)
    register_graph("my_graph", metadata={"nodes": [...]})
    result = traced_invoke(compiled_graph, state, run_name="my_graph")
"""
from __future__ import annotations

import contextvars
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

__all__ = [
    "TracingConfig",
    "configure_tracing",
    "get_tracing_config",
    "reset_tracing",
    "get_langsmith_client",
    "register_graph",
    "traced_invoke",
    "trace_node",
    "get_correlation_id",
    "set_correlation_id",
    "log_event",
]

_CORRELATION_ID: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "langstitch_correlation_id", default=None
)
_TRACING: Optional["TracingConfig"] = None
_REGISTERED_GRAPHS: Dict[str, Dict[str, Any]] = {}


@dataclass
class TracingConfig:
    """Resolved tracing settings (from config + environment)."""

    enabled: bool = False
    project: str = "langstitch"
    endpoint: str = ""
    api_key: str = ""
    log_format: str = "text"  # text | json
    log_level: str = "INFO"
    register_on_build: bool = True
    trace_nodes: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def langsmith_available(self) -> bool:
        return bool(self.enabled and self.api_key)


def _resolve_tracing_config() -> TracingConfig:
    from .providers import get_config, get_env, get_secret

    try:
        cfg = get_config()
        section = cfg.section("tracing", {}) or {}
    except Exception:  # pragma: no cover - no config loaded yet
        section = {}

    api_key = (
        get_secret("LANGSMITH_API_KEY")
        or get_secret("LANGCHAIN_API_KEY")
        or section.get("api_key")
        or ""
    )
    if isinstance(api_key, str) and api_key.startswith("${"):
        api_key = get_env(api_key.strip("${}"), "") or ""

    enabled_raw = section.get("enabled", get_env("LANGSTITCH_TRACING", "false"))
    if isinstance(enabled_raw, str):
        enabled = enabled_raw.strip().lower() in {"1", "true", "yes", "on"}
    else:
        enabled = bool(enabled_raw)

    # LangSmith tracing is on when explicitly enabled OR when a key is present.
    if api_key and get_env("LANGCHAIN_TRACING_V2", "").lower() in {"true", "1", "yes"}:
        enabled = True

    project = (
        section.get("project")
        or get_env("LANGCHAIN_PROJECT")
        or get_env("LANGSMITH_PROJECT")
        or "langstitch"
    )
    endpoint = section.get("endpoint") or get_env("LANGCHAIN_ENDPOINT", "")
    log_format = (section.get("log_format") or get_env("LOG_FORMAT", "text")).lower()
    log_level = (section.get("log_level") or get_env("LOG_LEVEL", "INFO")).upper()

    return TracingConfig(
        enabled=enabled,
        project=str(project),
        endpoint=str(endpoint or ""),
        api_key=str(api_key or ""),
        log_format=log_format,
        log_level=log_level,
        register_on_build=bool(section.get("register_on_build", True)),
        trace_nodes=bool(section.get("trace_nodes", True)),
        metadata=dict(section.get("metadata", {})),
    )


class _JsonLogFormatter(logging.Formatter):
    """Emit one JSON object per log line for log aggregators."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        cid = _CORRELATION_ID.get()
        if cid:
            payload["correlation_id"] = cid
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_tracing(*, force: bool = False) -> TracingConfig:
    """Apply tracing + logging settings from config and environment.

    Exports LangSmith-related env vars when tracing is enabled so LangChain /
    LangGraph integrations pick them up automatically.
    """
    global _TRACING
    if _TRACING is not None and not force:
        return _TRACING

    cfg = _resolve_tracing_config()
    _TRACING = cfg

    level = getattr(logging, cfg.log_level, logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)

    if cfg.log_format == "json":
        handler = logging.StreamHandler()
        handler.setFormatter(_JsonLogFormatter())
        root.handlers = [handler]
    elif not root.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        )

    if cfg.langsmith_available:
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_PROJECT", cfg.project)
        if cfg.api_key:
            os.environ.setdefault("LANGCHAIN_API_KEY", cfg.api_key)
            os.environ.setdefault("LANGSMITH_API_KEY", cfg.api_key)
        if cfg.endpoint:
            os.environ.setdefault("LANGCHAIN_ENDPOINT", cfg.endpoint)

    log = logging.getLogger("langstitch.tracing")
    log.debug(
        "tracing configured enabled=%s project=%s langsmith=%s format=%s",
        cfg.enabled,
        cfg.project,
        cfg.langsmith_available,
        cfg.log_format,
    )
    return cfg


def get_tracing_config() -> TracingConfig:
    """Return the active tracing config (configures lazily if needed)."""
    global _TRACING
    if _TRACING is None:
        return configure_tracing()
    return _TRACING


def reset_tracing() -> None:
    """Clear cached tracing state (primarily for tests)."""
    global _TRACING
    _TRACING = None
    _REGISTERED_GRAPHS.clear()
    _CORRELATION_ID.set(None)


def get_correlation_id() -> str:
    """Return the current correlation id (creates one if missing)."""
    cid = _CORRELATION_ID.get()
    if not cid:
        cid = str(uuid.uuid4())
        _CORRELATION_ID.set(cid)
    return cid


def set_correlation_id(correlation_id: Optional[str]) -> None:
    _CORRELATION_ID.set(correlation_id)


def log_event(event: str, **fields: Any) -> None:
    """Structured log line tagged with correlation id."""
    log = logging.getLogger("langstitch.events")
    payload = {"event": event, "correlation_id": get_correlation_id(), **fields}
    if get_tracing_config().log_format == "json":
        log.info(json.dumps(payload, default=str))
    else:
        log.info("%s %s", event, payload)


def get_langsmith_client() -> Any:
    """Return a LangSmith :class:`~langsmith.Client` (requires ``langsmith``)."""
    cfg = get_tracing_config()
    if not cfg.langsmith_available:
        raise RuntimeError(
            "LangSmith client requires tracing.enabled=true and LANGSMITH_API_KEY. "
            "Install with: pip install langsmith"
        )
    try:
        from langsmith import Client
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "get_langsmith_client() requires langsmith. Install with:\n"
            "    pip install 'langstitch[tracing]'"
        ) from exc

    kwargs: Dict[str, Any] = {}
    if cfg.endpoint:
        kwargs["api_url"] = cfg.endpoint
    return Client(api_key=cfg.api_key, **kwargs)


def register_graph(
    name: str,
    *,
    description: str = "",
    metadata: Optional[Dict[str, Any]] = None,
    graph_structure: Optional[Dict[str, Any]] = None,
    upsert: bool = True,
) -> Dict[str, Any]:
    """Register (or upsert) a graph with LangSmith as a traced project.

    Always records registration locally; when LangSmith is configured, ensures
    a project exists and attaches graph metadata for the LangSmith UI.
    """
    cfg = get_tracing_config()
    meta = {**cfg.metadata, **(metadata or {})}
    if graph_structure:
        meta["graph"] = graph_structure

    record: Dict[str, Any] = {
        "name": name,
        "description": description,
        "project": cfg.project,
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "langsmith": False,
        "metadata": meta,
    }

    if cfg.langsmith_available and cfg.register_on_build:
        try:
            client = get_langsmith_client()
            project_name = cfg.project
            if hasattr(client, "has_project") and client.has_project(project_name):
                session = client.read_project(project_name=project_name)
            else:
                session = client.create_project(
                    project_name=project_name,
                    description=description or f"LangStitch graph: {name}",
                    metadata={"graph_name": name, **meta},
                    upsert=upsert,
                )
            record["langsmith"] = True
            record["project_id"] = str(getattr(session, "id", ""))
            record["project_url"] = getattr(session, "url", None)
            log_event(
                "graph.registered",
                graph=name,
                project=project_name,
                langsmith=True,
            )
        except Exception as exc:  # pragma: no cover - network optional
            record["langsmith_error"] = str(exc)
            log_event("graph.register_failed", graph=name, error=str(exc))

    _REGISTERED_GRAPHS[name] = record
    return record


def traced_invoke(
    graph: Any,
    state: Dict[str, Any],
    *,
    run_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    **kwargs: Any,
) -> Any:
    """Invoke a compiled graph with optional LangSmith run tracing."""
    cfg = get_tracing_config()
    name = run_name or "langstitch.invoke"
    cid = get_correlation_id()

    log_event("graph.invoke.start", run=name, correlation_id=cid)

    if not cfg.langsmith_available:
        result = graph.invoke(state, **kwargs)
        log_event("graph.invoke.end", run=name, traced=False)
        return result

    try:
        from langsmith import traceable
    except ImportError:  # pragma: no cover
        result = graph.invoke(state, **kwargs)
        log_event("graph.invoke.end", run=name, traced=False)
        return result

    @traceable(name=name, metadata={"correlation_id": cid, **(metadata or {})})
    def _run(input_state: Dict[str, Any]) -> Any:
        return graph.invoke(input_state, **kwargs)

    result = _run(state)
    log_event("graph.invoke.end", run=name, traced=True)
    return result


def trace_node(handler: Callable[..., Any]) -> Callable[..., Any]:
    """Wrap a graph node handler with LangSmith tracing when enabled."""
    import functools

    traced_fn: Optional[Callable[..., Any]] = None

    @functools.wraps(handler)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        nonlocal traced_fn
        cfg = get_tracing_config()
        if not (cfg.trace_nodes and cfg.langsmith_available):
            return handler(*args, **kwargs)
        if traced_fn is None:
            try:
                from langsmith import traceable

                node_name = getattr(handler, "__name__", "node")
                traced_fn = traceable(name=f"node.{node_name}", run_type="chain")(handler)
            except ImportError:  # pragma: no cover
                return handler(*args, **kwargs)
        return traced_fn(*args, **kwargs)

    return wrapped


def registered_graphs() -> Dict[str, Dict[str, Any]]:
    """Return locally recorded graph registrations."""
    return dict(_REGISTERED_GRAPHS)
