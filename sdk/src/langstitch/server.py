"""``@langstitch_graph_server`` — turn a class into a runnable graph API server.

The decorator registers server metadata and attaches helpers that build a
FastAPI application exposing the registered entrypoint graph. FastAPI/uvicorn
are optional (the ``server`` extra); importing this module never requires them.
"""
from __future__ import annotations

from typing import Any, Optional

from ._decorators import resolve_name
from .registry import ServerSpec, get_registry

__all__ = ["langstitch_graph_server", "create_app", "run"]


def langstitch_graph_server(
    _target: Any = None,
    /,
    *,
    name: Optional[str] = None,
    protocol: str = "http",
    port: int = 8000,
    host: str = "0.0.0.0",
    title: Optional[str] = None,
    version: str = "0.1.0",
    properties: Optional[str] = None,
):
    """Mark a class as the application's graph server entrypoint.

    ``protocol`` selects the transport (``http`` (default), ``grpc``,
    ``websocket``). ``properties`` is the relative (or absolute) path to the
    config file to load on startup; when omitted the runtime uses
    ``application.json`` at the project root (falling back to
    ``application.yaml``). Adds ``create_app()`` / ``serve()`` / ``load_config()``
    classmethods.
    """

    def wrap(cls: Any) -> Any:
        resolved = resolve_name(cls, name)
        spec = ServerSpec(
            name=resolved,
            target=cls,
            title=title or resolved,
            version=version,
            protocol=protocol,
            host=host,
            port=port,
            properties=properties,
        )
        get_registry().set_server(spec)

        def _create_app(_cls):  # noqa: ANN001
            return create_app(spec)

        def _serve(_cls, **kwargs):  # noqa: ANN001
            return run(spec, **kwargs)

        def _load_config(_cls):  # noqa: ANN001
            from .config import load_config

            return load_config(properties=spec.properties)

        cls.create_app = classmethod(_create_app)
        cls.serve = classmethod(_serve)
        cls.load_config = classmethod(_load_config)
        cls._langstitch_server = spec
        _attach_internal_tools(cls)
        return cls

    if _target is not None:
        return wrap(_target)
    return wrap


def _attach_internal_tools(cls: Any) -> None:
    """Attach the graph server's internal introspection tools as classmethods.

    These are dynamic: each call hits the lazily-refreshed registries, so a
    server picks up tools/agents/guardrails registered after start-up without a
    restart, and never eagerly loads everything up front.
    """
    from . import registries as _reg
    from .context import Context, ContextBuilder

    def _bind(fn):
        return classmethod(lambda _cls, *a, **k: fn(*a, **k))

    cls.get_all_tools = _bind(_reg.get_all_tools)
    cls.get_all_worker_agents = _bind(_reg.get_all_worker_agents)
    cls.get_input_guardrails = _bind(_reg.get_input_guardrails)
    cls.get_output_guardrails = _bind(_reg.get_output_guardrails)
    cls.get_skills = _bind(_reg.get_skills)
    cls.get_policies = _bind(_reg.get_policies)
    cls.get_personas = _bind(_reg.get_personas)
    cls.refresh_registries = _bind(_reg.refresh_registries)

    cls.get_tool = classmethod(lambda _cls, name: _reg.get_tool_registry().get(name))
    cls.get_worker_agent = classmethod(lambda _cls, name: _reg.get_agent_registry().get(name))
    cls.tool_registry = classmethod(lambda _cls: _reg.get_tool_registry())
    cls.agent_registry = classmethod(lambda _cls: _reg.get_agent_registry())
    cls.context_builder = classmethod(lambda _cls: ContextBuilder())
    cls.new_context = classmethod(lambda _cls, **kw: Context(**kw))


def create_app(spec: Optional[ServerSpec] = None) -> Any:
    """Build a FastAPI app exposing health + invoke endpoints."""
    try:
        from fastapi import FastAPI
        from pydantic import BaseModel
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "create_app() requires FastAPI. Install it with:\n"
            "    pip install 'langstitch[server]'"
        ) from exc

    from .app import LangStitchApp

    spec = spec or get_registry().server
    title = spec.title if spec else "LangStitch App"
    version = spec.version if spec else "0.1.0"

    api = FastAPI(title=title, version=version)
    runtime = LangStitchApp.bootstrap(properties=spec.properties if spec else None)

    class InvokeRequest(BaseModel):
        state: dict

    @api.get("/health")
    def health() -> dict:
        return {"status": "ok", "app": runtime.config.name}

    @api.get("/info")
    def info() -> dict:
        return runtime.info()

    @api.post("/invoke")
    def invoke(req: InvokeRequest) -> dict:
        result = runtime.invoke(req.state)
        return {"result": result}

    return api


def run(spec: Optional[ServerSpec] = None, *, host: Optional[str] = None, port: Optional[int] = None) -> None:
    """Run the server with uvicorn."""
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "run() requires uvicorn. Install it with:\n"
            "    pip install 'langstitch[server]'"
        ) from exc

    spec = spec or get_registry().server
    api = create_app(spec)
    uvicorn.run(
        api,
        host=host or (spec.host if spec else "0.0.0.0"),
        port=port or (spec.port if spec else 8000),
    )
