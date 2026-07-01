"""Outbound A2A client — call other agents *over the SDK auth layer*.

The client fetches a remote Agent Card and sends JSON-RPC ``message/send``
requests. Credentials are resolved through the existing
:mod:`langstitch.services` auth layer:

* If the remote agent is declared as an ``external_services`` entry (referenced
  via ``service=`` on :func:`langstitch.a2a_agent`), the call reuses that
  service's ``bearer`` / ``basic`` / ``api_key`` / ``oauth2`` config and inbound
  header propagation.
* Otherwise a bearer token can be supplied directly or read from an environment
  variable (the ``authEnvVar`` the IDE emits, e.g. ``A2A_API_KEY``).

httpx is an optional dependency (the ``http`` extra); it is imported lazily.
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Dict, List, Optional

from .a2a import AgentCard, AgentSkill, A2AMessage
from .registry import A2AAgentSpec, get_registry

__all__ = [
    "A2AClient",
    "AsyncA2AClient",
    "a2a_client",
    "async_a2a_client",
    "invoke_a2a_agent",
    "ainvoke_a2a_agent",
]

_WELL_KNOWN = "/.well-known/agent.json"


def _require_httpx() -> Any:
    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - optional extra
        raise RuntimeError(
            "A2A client requires httpx. Install it with:\n"
            "    pip install 'langstitch[http]'"
        ) from exc
    return httpx


def _resolve_agent(name_or_spec: Any) -> Optional[A2AAgentSpec]:
    if isinstance(name_or_spec, A2AAgentSpec):
        return name_or_spec
    return get_registry().a2a_agents.get(str(name_or_spec))


def _client_kwargs(
    *,
    service: str,
    agent_card_url: str,
    token: Optional[str],
    auth_env: Optional[str],
    request_headers: Optional[Dict[str, str]],
    overrides: Dict[str, Any],
    httpx: Any,
) -> Dict[str, Any]:
    """Assemble httpx client kwargs, reusing the services auth layer."""
    if service:
        from .services import build_service_client_kwargs, load_service_config

        svc = load_service_config(service)
        return build_service_client_kwargs(
            svc, httpx, request_headers=request_headers, overrides=overrides
        )

    kwargs: Dict[str, Any] = {}
    if agent_card_url:
        # base_url is the agent's origin; the card path stays relative.
        from urllib.parse import urlsplit

        parts = urlsplit(agent_card_url)
        if parts.scheme and parts.netloc:
            kwargs["base_url"] = f"{parts.scheme}://{parts.netloc}"

    headers: Dict[str, str] = {}
    resolved_token = token or (os.environ.get(auth_env) if auth_env else None)
    if resolved_token:
        headers["Authorization"] = f"Bearer {resolved_token}"
    if request_headers:
        headers.update(request_headers)
    if headers:
        kwargs["headers"] = headers
    kwargs.update(overrides)
    return kwargs


def _card_path(agent_card_url: str) -> str:
    if not agent_card_url:
        return _WELL_KNOWN
    from urllib.parse import urlsplit

    parts = urlsplit(agent_card_url)
    return parts.path or _WELL_KNOWN


def _parse_card(raw: Dict[str, Any]) -> AgentCard:
    caps = raw.get("capabilities") or {}
    skills = [
        AgentSkill(
            id=s.get("id", ""),
            name=s.get("name", ""),
            description=s.get("description", ""),
            tags=list(s.get("tags", []) or []),
            examples=list(s.get("examples", []) or []),
            input_modes=list(s.get("inputModes", []) or []),
            output_modes=list(s.get("outputModes", []) or []),
        )
        for s in (raw.get("skills") or [])
    ]
    from .a2a import AgentCapabilities

    return AgentCard(
        name=raw.get("name", ""),
        description=raw.get("description", ""),
        url=raw.get("url", ""),
        version=raw.get("version", "0.1.0"),
        protocol_version=raw.get("protocolVersion", raw.get("protocol_version", "0.2")),
        capabilities=AgentCapabilities(
            streaming=bool(caps.get("streaming", False)),
            push_notifications=bool(caps.get("pushNotifications", False)),
            state_transition_history=bool(caps.get("stateTransitionHistory", False)),
        ),
        skills=skills,
        default_input_modes=list(raw.get("defaultInputModes", []) or ["text/plain"]),
        default_output_modes=list(raw.get("defaultOutputModes", []) or ["text/plain"]),
    )


def _message_send_payload(
    message: Any,
    *,
    skill_id: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if isinstance(message, str):
        msg = A2AMessage(
            role="user",
            parts=[],
            message_id=uuid.uuid4().hex,
        )
        from .a2a import A2APart

        msg.parts = [A2APart(kind="text", text=message)]
    elif isinstance(message, A2AMessage):
        msg = message
        if not msg.message_id:
            msg.message_id = uuid.uuid4().hex
    elif isinstance(message, dict):
        msg = A2AMessage.from_dict(message)
        if not msg.message_id:
            msg.message_id = uuid.uuid4().hex
    else:
        raise TypeError(f"unsupported A2A message type: {type(message)!r}")

    meta = dict(metadata or {})
    if skill_id:
        meta["skillId"] = skill_id
    if meta:
        msg.metadata = {**msg.metadata, **meta}

    return {
        "jsonrpc": "2.0",
        "id": uuid.uuid4().hex,
        "method": "message/send",
        "params": {"message": msg.to_dict()},
    }


def _unwrap_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    if "error" in payload and payload["error"]:
        err = payload["error"]
        raise RuntimeError(f"A2A error {err.get('code')}: {err.get('message')}")
    return payload.get("result", payload)


class _BaseA2AClient:
    def __init__(self, client: Any, *, agent_card_url: str = "") -> None:
        self._client = client
        self._agent_card_url = agent_card_url

    @property
    def httpx_client(self) -> Any:
        return self._client


class A2AClient(_BaseA2AClient):
    """Synchronous A2A client wrapping a configured ``httpx.Client``."""

    def get_agent_card(self) -> AgentCard:
        resp = self._client.get(_card_path(self._agent_card_url))
        resp.raise_for_status()
        return _parse_card(resp.json())

    def send_message(
        self,
        message: Any,
        *,
        skill_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        path: str = "/",
    ) -> Dict[str, Any]:
        payload = _message_send_payload(message, skill_id=skill_id, metadata=metadata)
        resp = self._client.post(path, json=payload)
        resp.raise_for_status()
        return _unwrap_result(resp.json())

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "A2AClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class AsyncA2AClient(_BaseA2AClient):
    """Asynchronous A2A client wrapping a configured ``httpx.AsyncClient``."""

    async def get_agent_card(self) -> AgentCard:
        resp = await self._client.get(_card_path(self._agent_card_url))
        resp.raise_for_status()
        return _parse_card(resp.json())

    async def send_message(
        self,
        message: Any,
        *,
        skill_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        path: str = "/",
    ) -> Dict[str, Any]:
        payload = _message_send_payload(message, skill_id=skill_id, metadata=metadata)
        resp = await self._client.post(path, json=payload)
        resp.raise_for_status()
        return _unwrap_result(resp.json())

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncA2AClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()


def a2a_client(
    agent: Any = None,
    *,
    agent_card_url: str = "",
    service: str = "",
    token: Optional[str] = None,
    auth_env: Optional[str] = None,
    request_headers: Optional[Dict[str, str]] = None,
    **overrides: Any,
) -> A2AClient:
    """Build a synchronous :class:`A2AClient`.

    ``agent`` may be a registered remote agent name (or :class:`A2AAgentSpec`)
    declared via :func:`langstitch.a2a_agent`; its ``service`` / ``agent_card_url``
    supply the base URL and auth. Otherwise pass ``agent_card_url`` (and
    optionally ``service`` / ``token`` / ``auth_env``) directly.
    """
    httpx = _require_httpx()
    spec = _resolve_agent(agent) if agent is not None else None
    if spec is not None:
        service = service or spec.service
        agent_card_url = agent_card_url or spec.agent_card_url
        auth_env = auth_env or str(spec.metadata.get("auth_env", "") or "") or None
    kwargs = _client_kwargs(
        service=service,
        agent_card_url=agent_card_url,
        token=token,
        auth_env=auth_env,
        request_headers=request_headers,
        overrides=overrides,
        httpx=httpx,
    )
    return A2AClient(httpx.Client(**kwargs), agent_card_url=agent_card_url)


def async_a2a_client(
    agent: Any = None,
    *,
    agent_card_url: str = "",
    service: str = "",
    token: Optional[str] = None,
    auth_env: Optional[str] = None,
    request_headers: Optional[Dict[str, str]] = None,
    **overrides: Any,
) -> AsyncA2AClient:
    """Build an asynchronous :class:`AsyncA2AClient` (see :func:`a2a_client`)."""
    httpx = _require_httpx()
    spec = _resolve_agent(agent) if agent is not None else None
    if spec is not None:
        service = service or spec.service
        agent_card_url = agent_card_url or spec.agent_card_url
        auth_env = auth_env or str(spec.metadata.get("auth_env", "") or "") or None
    kwargs = _client_kwargs(
        service=service,
        agent_card_url=agent_card_url,
        token=token,
        auth_env=auth_env,
        request_headers=request_headers,
        overrides=overrides,
        httpx=httpx,
    )
    return AsyncA2AClient(httpx.AsyncClient(**kwargs), agent_card_url=agent_card_url)


def invoke_a2a_agent(
    message: Any,
    *,
    agent: Any = None,
    agent_card_url: str = "",
    service: str = "",
    skill_id: str = "",
    token: Optional[str] = None,
    auth_env: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request_headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """One-shot synchronous A2A call: build a client, send a message, close."""
    with a2a_client(
        agent,
        agent_card_url=agent_card_url,
        service=service,
        token=token,
        auth_env=auth_env,
        request_headers=request_headers,
    ) as client:
        return client.send_message(message, skill_id=skill_id, metadata=metadata)


async def ainvoke_a2a_agent(
    message: Any,
    *,
    agent: Any = None,
    agent_card_url: str = "",
    service: str = "",
    skill_id: str = "",
    token: Optional[str] = None,
    auth_env: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request_headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """One-shot asynchronous A2A call (see :func:`invoke_a2a_agent`)."""
    async with async_a2a_client(
        agent,
        agent_card_url=agent_card_url,
        service=service,
        token=token,
        auth_env=auth_env,
        request_headers=request_headers,
    ) as client:
        return await client.send_message(message, skill_id=skill_id, metadata=metadata)
