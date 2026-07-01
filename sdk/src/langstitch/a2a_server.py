"""Inbound A2A server — publish this app as an A2A agent *behind auth + RBAC*.

Builds a FastAPI application that:

* serves the Agent Card at ``/.well-known/agent.json`` (RBAC-filtered to the
  caller's visible skills once authenticated);
* answers JSON-RPC ``message/send`` calls, running the targeted skill — but only
  after :func:`langstitch.a2a.authenticate` resolves the caller's identity (the
  **auth layer**) and :func:`langstitch.a2a.authorize` checks the skill's
  required roles (the **RBAC layer**).

Inbound credential headers are also pushed onto the request-header contextvar so
downstream ``external_services`` calls can propagate them (see
:mod:`langstitch.services`).

FastAPI/uvicorn are optional (the ``server`` extra) and imported lazily.
"""
import inspect
from typing import Any, Dict, Optional

from .a2a import (
    A2AAuthError,
    A2AIdentity,
    A2AMessage,
    A2APart,
    authenticate,
    authorize,
    build_agent_card,
    get_skill,
    load_a2a_server_config,
)
from .registry import A2ASkillSpec, A2AServerSpec, get_registry

__all__ = ["create_a2a_app", "run_a2a_server"]


def _result_to_message(result: Any) -> A2AMessage:
    parts = []
    if isinstance(result, str):
        parts.append(A2APart(kind="text", text=result))
    elif isinstance(result, dict):
        text = result.get("output") or result.get("text") or result.get("result")
        if isinstance(text, str):
            parts.append(A2APart(kind="text", text=text))
        parts.append(A2APart(kind="data", data=result))
    else:
        parts.append(A2APart(kind="text", text=str(result)))
    return A2AMessage(role="agent", parts=parts)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _resolve_skill(
    message: A2AMessage, params: Dict[str, Any]
) -> Optional[A2ASkillSpec]:
    skill_id = (
        message.metadata.get("skillId")
        or message.metadata.get("skill_id")
        or (params.get("metadata") or {}).get("skillId")
        or (params.get("configuration") or {}).get("skillId")
        or ""
    )
    if skill_id:
        return get_skill(str(skill_id))
    skills = list(get_registry().a2a_skills.values())
    enabled = [s for s in skills if s.enabled]
    if len(enabled) == 1:
        return enabled[0]
    return None


def create_a2a_app(spec: Optional[A2AServerSpec] = None) -> Any:
    """Build a FastAPI app exposing the Agent Card + JSON-RPC ``message/send``."""
    try:
        from fastapi import FastAPI, Request
        from fastapi.responses import JSONResponse
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "create_a2a_app() requires FastAPI. Install it with:\n"
            "    pip install 'langstitch[server]'"
        ) from exc

    spec = spec or get_registry().a2a_server
    title = spec.title if spec else "LangStitch A2A Agent"
    version = spec.version if spec else "0.1.0"

    api = FastAPI(title=title, version=version)
    config = load_a2a_server_config(spec=spec)

    # Lazily-built runtime fallback when no explicit skills are registered.
    _runtime: Dict[str, Any] = {}

    def _get_runtime() -> Any:
        if "app" not in _runtime:
            from .app import LangStitchApp

            _runtime["app"] = LangStitchApp.bootstrap(
                properties=spec.properties if spec else None
            )
        return _runtime["app"]

    def _auth(request: Request) -> A2AIdentity:
        headers = {k: v for k, v in request.headers.items()}
        return authenticate(headers, config)

    def _propagate(request: Request) -> Any:
        from .services import set_request_headers

        return set_request_headers({k: v for k, v in request.headers.items()})

    @api.get("/health")
    def health() -> dict:
        return {"status": "ok", "agent": title}

    @api.get("/.well-known/agent.json")
    def agent_card(request: Request) -> Any:
        # Discovery is allowed unauthenticated; if a valid credential is
        # presented we tailor the advertised skills to the caller's roles.
        identity: Optional[A2AIdentity] = None
        try:
            identity = _auth(request)
        except A2AAuthError:
            identity = None
        card = build_agent_card(spec, config=config, identity=identity)
        return card.to_dict()

    @api.post("/")
    async def rpc(request: Request) -> Any:
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return JSONResponse(
                {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}},
                status_code=400,
            )

        rpc_id = body.get("id")
        method = body.get("method")
        params = body.get("params") or {}

        # ── auth layer ──
        try:
            identity = _auth(request)
        except A2AAuthError as exc:
            return JSONResponse(
                {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": -32001, "message": str(exc)}},
                status_code=exc.status,
            )

        if method != "message/send":
            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {"code": -32601, "message": f"Method not found: {method}"},
                },
                status_code=404,
            )

        raw_message = params.get("message") or {}
        message = A2AMessage.from_dict(raw_message)
        skill = _resolve_skill(message, params)

        # ── rbac layer ──
        skills_registered = bool(get_registry().a2a_skills)
        if skills_registered:
            try:
                authorize(identity, skill, rbac_enabled=config.rbac_enabled)
            except A2AAuthError as exc:
                return JSONResponse(
                    {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": -32003, "message": str(exc)}},
                    status_code=exc.status,
                )

        token = _propagate(request)
        try:
            state: Dict[str, Any] = {
                "input": message.text(),
                "message": message.to_dict(),
                "metadata": message.metadata,
                "a2a_identity": {
                    "subject": identity.subject,
                    "roles": identity.roles,
                    "scopes": identity.scopes,
                },
            }
            if skill is not None and skill.target is not None:
                result = await _maybe_await(skill.target(state))
            else:
                result = await _maybe_await(_get_runtime().invoke(state))
        except A2AAuthError as exc:
            return JSONResponse(
                {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": -32003, "message": str(exc)}},
                status_code=exc.status,
            )
        except Exception as exc:  # noqa: BLE001
            return JSONResponse(
                {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {"code": -32603, "message": f"Internal error: {exc}"},
                },
                status_code=500,
            )
        finally:
            from .services import clear_request_headers

            clear_request_headers(token)

        response_message = _result_to_message(result)
        return {"jsonrpc": "2.0", "id": rpc_id, "result": response_message.to_dict()}

    return api


def run_a2a_server(
    spec: Optional[A2AServerSpec] = None,
    *,
    host: Optional[str] = None,
    port: Optional[int] = None,
) -> None:
    """Run the A2A server with uvicorn."""
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "run_a2a_server() requires uvicorn. Install it with:\n"
            "    pip install 'langstitch[server]'"
        ) from exc

    spec = spec or get_registry().a2a_server
    api = create_a2a_app(spec)
    uvicorn.run(
        api,
        host=host or (spec.host if spec else "0.0.0.0"),
        port=port or (spec.port if spec else 8100),
    )
