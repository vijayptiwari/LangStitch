"""Agent-to-Agent (A2A) protocol support for the LangStitch SDK.

This module lets a LangStitch app *publish* itself as an A2A agent (serving an
Agent Card and answering JSON-RPC ``message/send`` calls) and *consume* other
A2A agents — both **over the existing auth and RBAC layers**:

* **Auth layer** — outbound calls reuse :mod:`langstitch.services`
  (``bearer`` / ``basic`` / ``api_key`` / ``oauth2`` + header propagation).
  Inbound calls are verified by :func:`authenticate`, which resolves a caller's
  :class:`A2AIdentity` from a bearer token / API key (a static token table or a
  pluggable ``@a2a_authenticator``).
* **RBAC layer** — every skill carries ``roles``. :func:`authorize` enforces
  that the caller holds at least one required role, reusing the SDK convention
  that *an empty role list means unrestricted*.

Like the rest of the SDK, the decorators only record specs on the global
registry. Heavy dependencies (FastAPI / httpx) live behind the optional
``server`` / ``http`` extras and are imported lazily by the client/server
helpers, so importing this module is always cheap.

Decorators
----------
* ``@langstitch_a2a_server(...)`` — mark the class that hosts the A2A agent.
* ``@a2a_skill(skill_id=..., roles=[...])`` — register an invokable skill.
* ``@a2a_authenticator`` — register a custom inbound credential verifier.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import (
    A2AAgentSpec,
    A2AAuthenticatorSpec,
    A2ASkillSpec,
    A2AServerSpec,
    get_registry,
)

__all__ = [
    # decorators
    "langstitch_a2a_server",
    "a2a_skill",
    "a2a_agent",
    "a2a_authenticator",
    # models
    "AgentSkill",
    "AgentCapabilities",
    "AgentProvider",
    "SecurityScheme",
    "AgentCard",
    "A2AMessage",
    "A2APart",
    # auth + rbac
    "A2AIdentity",
    "A2AAuthError",
    "load_a2a_server_config",
    "authenticate",
    "authorize",
    "select_skills",
    "build_agent_card",
    "extract_text",
]


# ──────────────────────────────────────────────────────────────────────────
# Agent Card data models (A2A spec v0.2.x), kept dependency-free
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class AgentSkill:
    id: str
    name: str
    description: str = ""
    tags: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    input_modes: List[str] = field(default_factory=list)
    output_modes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {"id": self.id, "name": self.name}
        if self.description:
            out["description"] = self.description
        if self.tags:
            out["tags"] = list(self.tags)
        if self.examples:
            out["examples"] = list(self.examples)
        if self.input_modes:
            out["inputModes"] = list(self.input_modes)
        if self.output_modes:
            out["outputModes"] = list(self.output_modes)
        return out


@dataclass
class AgentCapabilities:
    streaming: bool = False
    push_notifications: bool = False
    state_transition_history: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "streaming": self.streaming,
            "pushNotifications": self.push_notifications,
            "stateTransitionHistory": self.state_transition_history,
        }


@dataclass
class AgentProvider:
    organization: str = ""
    url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {"organization": self.organization, "url": self.url}


@dataclass
class SecurityScheme:
    """An A2A securityScheme entry advertised in the Agent Card."""

    type: str = "http"  # http | apiKey | oauth2 | openIdConnect
    scheme: str = "bearer"  # for type=http
    name: str = "Authorization"  # for type=apiKey
    location: str = "header"  # for type=apiKey: header | query | cookie
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        if self.type == "apiKey":
            out: Dict[str, Any] = {"type": "apiKey", "name": self.name, "in": self.location}
        elif self.type == "http":
            out = {"type": "http", "scheme": self.scheme}
        else:
            out = {"type": self.type}
        if self.description:
            out["description"] = self.description
        return out


@dataclass
class AgentCard:
    name: str
    description: str = ""
    url: str = ""
    version: str = "0.1.0"
    protocol_version: str = "0.2"
    capabilities: AgentCapabilities = field(default_factory=AgentCapabilities)
    skills: List[AgentSkill] = field(default_factory=list)
    default_input_modes: List[str] = field(default_factory=lambda: ["text/plain"])
    default_output_modes: List[str] = field(default_factory=lambda: ["text/plain"])
    security_schemes: Dict[str, SecurityScheme] = field(default_factory=dict)
    security: List[Dict[str, List[str]]] = field(default_factory=list)
    provider: Optional[AgentProvider] = None

    def to_dict(self) -> Dict[str, Any]:
        card: Dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "url": self.url,
            "version": self.version,
            "protocolVersion": self.protocol_version,
            "capabilities": self.capabilities.to_dict(),
            "defaultInputModes": list(self.default_input_modes),
            "defaultOutputModes": list(self.default_output_modes),
            "skills": [s.to_dict() for s in self.skills],
        }
        if self.security_schemes:
            card["securitySchemes"] = {
                key: scheme.to_dict() for key, scheme in self.security_schemes.items()
            }
        if self.security:
            card["security"] = self.security
        if self.provider is not None:
            card["provider"] = self.provider.to_dict()
        return card


@dataclass
class A2APart:
    kind: str = "text"
    text: str = ""
    data: Any = None

    def to_dict(self) -> Dict[str, Any]:
        if self.kind == "text":
            return {"kind": "text", "text": self.text}
        return {"kind": self.kind, "data": self.data}

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "A2APart":
        kind = raw.get("kind") or raw.get("type") or "text"
        if kind == "text":
            return cls(kind="text", text=str(raw.get("text", "")))
        return cls(kind=kind, data=raw.get("data"))


@dataclass
class A2AMessage:
    role: str = "user"  # user | agent
    parts: List[A2APart] = field(default_factory=list)
    message_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def text(self) -> str:
        return "\n".join(p.text for p in self.parts if p.kind == "text" and p.text)

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "role": self.role,
            "parts": [p.to_dict() for p in self.parts],
            "kind": "message",
        }
        if self.message_id:
            out["messageId"] = self.message_id
        if self.metadata:
            out["metadata"] = self.metadata
        return out

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "A2AMessage":
        parts = [A2APart.from_dict(p) for p in (raw.get("parts") or [])]
        return cls(
            role=raw.get("role", "user"),
            parts=parts,
            message_id=raw.get("messageId", raw.get("message_id", "")),
            metadata=dict(raw.get("metadata") or {}),
        )

    @classmethod
    def text_message(cls, text: str, *, role: str = "agent", message_id: str = "") -> "A2AMessage":
        return cls(role=role, parts=[A2APart(kind="text", text=text)], message_id=message_id)


def extract_text(raw_message: Dict[str, Any]) -> str:
    """Pull concatenated text from a raw A2A message dict."""
    return A2AMessage.from_dict(raw_message or {}).text()


# ──────────────────────────────────────────────────────────────────────────
# Auth + RBAC layer (pure-Python, fully unit-testable)
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class A2AIdentity:
    """The authenticated caller of an inbound A2A request.

    ``roles`` feeds the RBAC layer (:func:`authorize`). ``scopes`` and ``claims``
    carry any additional context a custom authenticator wants to surface.
    """

    subject: str = "anonymous"
    roles: List[str] = field(default_factory=list)
    scopes: List[str] = field(default_factory=list)
    authenticated: bool = False
    claims: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def anonymous(cls, roles: Optional[List[str]] = None) -> "A2AIdentity":
        return cls(subject="anonymous", roles=list(roles or []), authenticated=False)


class A2AAuthError(Exception):
    """Raised when inbound A2A auth/authorization fails.

    ``status`` maps to the HTTP status the server returns (401 vs 403).
    """

    def __init__(self, message: str, *, status: int = 401) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class A2AServerConfig:
    """Resolved inbound A2A server settings (from ``a2a.server`` in config)."""

    auth_required: bool = True
    rbac_enabled: bool = True
    default_roles: List[str] = field(default_factory=list)
    header: str = "Authorization"
    scheme: str = "bearer"  # bearer | api_key
    api_key_header: str = "X-API-Key"
    tokens: Dict[str, Dict[str, Any]] = field(default_factory=dict)


def _server_section(cfg: Any = None) -> Dict[str, Any]:
    if cfg is None:
        from .providers import get_config

        cfg = get_config()
    a2a = cfg.section("a2a", {}) or {}
    server = a2a.get("server") if isinstance(a2a, dict) else None
    return server or {}


def load_a2a_server_config(cfg: Any = None, *, spec: Optional[A2AServerSpec] = None) -> A2AServerConfig:
    """Merge the registered :class:`A2AServerSpec` with the ``a2a.server`` config.

    Config keys (all optional)::

        a2a:
          server:
            auth:
              required: true
              scheme: bearer            # bearer | api_key
              header: Authorization
              api_key_header: X-API-Key
              tokens:                   # static token -> identity table
                "tok-abc": { subject: billing-agent, roles: [billing] }
            rbac:
              enabled: true
              default_roles: [guest]
    """
    section = _server_section(cfg)
    auth = section.get("auth") or {}
    rbac = section.get("rbac") or {}

    spec = spec or get_registry().a2a_server
    auth_required = bool(auth.get("required", spec.auth_required if spec else True))
    rbac_enabled = bool(rbac.get("enabled", spec.rbac_enabled if spec else True))
    default_roles = list(
        rbac.get("default_roles", (spec.default_roles if spec else []) or [])
    )

    tokens_raw = auth.get("tokens") or {}
    tokens: Dict[str, Dict[str, Any]] = {}
    for token, meta in tokens_raw.items():
        meta = meta or {}
        tokens[str(token)] = {
            "subject": meta.get("subject", "agent"),
            "roles": list(meta.get("roles", []) or []),
            "scopes": list(meta.get("scopes", []) or []),
            "claims": dict(meta.get("claims", {}) or {}),
        }

    return A2AServerConfig(
        auth_required=auth_required,
        rbac_enabled=rbac_enabled,
        default_roles=default_roles,
        header=str(auth.get("header", "Authorization")),
        scheme=str(auth.get("scheme", "bearer")).lower(),
        api_key_header=str(auth.get("api_key_header", "X-API-Key")),
        tokens=tokens,
    )


def _credential_from_headers(headers: Dict[str, str], config: A2AServerConfig) -> Optional[str]:
    lower = {k.lower(): v for k, v in (headers or {}).items()}
    if config.scheme == "api_key":
        return lower.get(config.api_key_header.lower())
    value = lower.get(config.header.lower())
    if not value:
        return None
    parts = value.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return value.strip()


def _coerce_identity(result: Any) -> Optional[A2AIdentity]:
    if result is None:
        return None
    if isinstance(result, A2AIdentity):
        return result
    if isinstance(result, dict):
        return A2AIdentity(
            subject=result.get("subject", "agent"),
            roles=list(result.get("roles", []) or []),
            scopes=list(result.get("scopes", []) or []),
            authenticated=bool(result.get("authenticated", True)),
            claims=dict(result.get("claims", {}) or {}),
        )
    raise A2AAuthError("authenticator returned an unsupported identity type", status=500)


def authenticate(
    headers: Dict[str, str],
    config: Optional[A2AServerConfig] = None,
    *,
    verifier: Optional[Callable[[Dict[str, str]], Any]] = None,
) -> A2AIdentity:
    """Resolve the calling :class:`A2AIdentity` for an inbound A2A request.

    Resolution order:

    1. A registered ``@a2a_authenticator`` (or explicit ``verifier``) — for
       JWT/JWKS or IdP introspection. Returning ``None`` falls through.
    2. The static token table (``a2a.server.auth.tokens``).
    3. If auth is not required, an anonymous identity carrying ``default_roles``.

    Raises :class:`A2AAuthError` (401) when a credential is required but missing
    or invalid.
    """
    config = config or load_a2a_server_config()

    verifier = verifier or _registered_authenticator()
    if verifier is not None:
        identity = _coerce_identity(verifier(dict(headers or {})))
        if identity is not None:
            return identity

    credential = _credential_from_headers(headers, config)
    if credential and credential in config.tokens:
        meta = config.tokens[credential]
        return A2AIdentity(
            subject=meta.get("subject", "agent"),
            roles=list(meta.get("roles", [])),
            scopes=list(meta.get("scopes", [])),
            authenticated=True,
            claims=dict(meta.get("claims", {})),
        )

    if credential and config.auth_required:
        raise A2AAuthError("invalid A2A credential", status=401)

    if config.auth_required:
        raise A2AAuthError("A2A authentication required", status=401)

    return A2AIdentity.anonymous(config.default_roles)


def _registered_authenticator() -> Optional[Callable[[Dict[str, str]], Any]]:
    spec = get_registry().a2a_authenticator
    return spec.target if spec else None


def authorize(
    identity: A2AIdentity,
    skill: Optional[A2ASkillSpec],
    *,
    rbac_enabled: bool = True,
) -> None:
    """Enforce the RBAC layer for invoking ``skill``.

    A skill with no ``roles`` is unrestricted (matching tool/MCP semantics).
    Otherwise the caller must hold at least one of the skill's roles. Raises
    :class:`A2AAuthError` (403) when access is denied.
    """
    if not rbac_enabled:
        return
    if skill is None:
        raise A2AAuthError("unknown A2A skill", status=404)
    if not getattr(skill, "enabled", True):
        raise A2AAuthError(f"skill {skill.skill_id!r} is disabled", status=404)
    required = set(skill.roles or [])
    if not required:
        return
    if not (set(identity.roles) & required):
        raise A2AAuthError(
            f"role(s) {sorted(required)} required for skill {skill.skill_id!r}",
            status=403,
        )


def select_skills(
    identity: Optional[A2AIdentity] = None,
    *,
    rbac_enabled: bool = True,
    enabled_only: bool = True,
) -> List[A2ASkillSpec]:
    """Return registered skills visible to ``identity`` (RBAC-filtered)."""
    skills = list(get_registry().a2a_skills.values())
    out: List[A2ASkillSpec] = []
    roles = set(identity.roles) if identity else set()
    for skill in skills:
        if enabled_only and not skill.enabled:
            continue
        if rbac_enabled and skill.roles and not (roles & set(skill.roles)):
            continue
        out.append(skill)
    return out


def get_skill(skill_id: str) -> Optional[A2ASkillSpec]:
    """Look up a registered skill by its ``skill_id`` (falls back to name)."""
    for skill in get_registry().a2a_skills.values():
        if skill.skill_id == skill_id or skill.name == skill_id:
            return skill
    return None


# ──────────────────────────────────────────────────────────────────────────
# Agent Card assembly
# ──────────────────────────────────────────────────────────────────────────
def build_agent_card(
    spec: Optional[A2AServerSpec] = None,
    *,
    config: Optional[A2AServerConfig] = None,
    identity: Optional[A2AIdentity] = None,
) -> AgentCard:
    """Build the Agent Card from the registered server + skill specs.

    When ``identity`` is provided, the advertised skills are RBAC-filtered to
    those the caller may actually invoke; otherwise all enabled skills are
    listed (an unauthenticated discovery view).
    """
    spec = spec or get_registry().a2a_server
    config = config or load_a2a_server_config(spec=spec)

    skills = select_skills(
        identity,
        rbac_enabled=config.rbac_enabled and identity is not None,
    )
    card_skills = [
        AgentSkill(
            id=s.skill_id or s.name,
            name=s.name,
            description=s.description,
            tags=list(s.tags),
            examples=list(s.examples),
            input_modes=list(s.input_modes),
            output_modes=list(s.output_modes),
        )
        for s in skills
    ]

    security_schemes: Dict[str, SecurityScheme] = {}
    security: List[Dict[str, List[str]]] = []
    if config.auth_required:
        if config.scheme == "api_key":
            security_schemes["apiKey"] = SecurityScheme(
                type="apiKey", name=config.api_key_header, location="header"
            )
            security = [{"apiKey": []}]
        else:
            security_schemes["bearer"] = SecurityScheme(type="http", scheme="bearer")
            security = [{"bearer": []}]

    return AgentCard(
        name=spec.title if spec else "LangStitch A2A Agent",
        description=spec.description if spec else "",
        url=(spec.url if spec else "") or "",
        version=spec.version if spec else "0.1.0",
        protocol_version=spec.protocol_version if spec else "0.2",
        capabilities=AgentCapabilities(streaming=bool(spec.streaming) if spec else False),
        skills=card_skills,
        security_schemes=security_schemes,
        security=security,
    )


# ──────────────────────────────────────────────────────────────────────────
# Decorators
# ──────────────────────────────────────────────────────────────────────────
def langstitch_a2a_server(
    _target: Any = None,
    /,
    *,
    name: Optional[str] = None,
    title: Optional[str] = None,
    version: str = "0.1.0",
    protocol_version: str = "0.2",
    host: str = "0.0.0.0",
    port: int = 8100,
    url: str = "",
    description: Optional[str] = None,
    auth_required: bool = True,
    rbac_enabled: bool = True,
    default_roles: Optional[List[str]] = None,
    streaming: bool = False,
    properties: Optional[str] = None,
):
    """Mark a class as the application's A2A agent server.

    The agent advertises an Agent Card at ``/.well-known/agent.json`` and
    answers JSON-RPC ``message/send`` calls. ``auth_required`` and
    ``rbac_enabled`` toggle the inbound auth and RBAC layers (config under
    ``a2a.server`` overrides these). Adds ``create_app()`` / ``serve()`` /
    ``load_config()`` classmethods.
    """

    def wrap(cls: Any) -> Any:
        resolved = resolve_name(cls, name)
        spec = A2AServerSpec(
            name=resolved,
            target=cls,
            description=resolve_description(cls, description),
            title=title or resolved,
            version=version,
            protocol_version=protocol_version,
            host=host,
            port=port,
            url=url,
            auth_required=auth_required,
            rbac_enabled=rbac_enabled,
            default_roles=list(default_roles or []),
            streaming=streaming,
            properties=properties,
        )
        get_registry().set_a2a_server(spec)

        def _create_app(_cls):  # noqa: ANN001
            from .a2a_server import create_a2a_app

            return create_a2a_app(spec)

        def _serve(_cls, **kwargs):  # noqa: ANN001
            from .a2a_server import run_a2a_server

            return run_a2a_server(spec, **kwargs)

        def _load_config(_cls):  # noqa: ANN001
            from .config import load_config

            return load_config(properties=spec.properties)

        cls.create_app = classmethod(_create_app)
        cls.serve = classmethod(_serve)
        cls.load_config = classmethod(_load_config)
        cls._langstitch_a2a_server = spec
        return cls

    if _target is not None:
        return wrap(_target)
    return wrap


def _register_skill(target: Callable[..., Any], options: dict) -> None:
    resolved = resolve_name(target, options.get("name"))
    spec = A2ASkillSpec(
        name=resolved,
        target=target,
        description=resolve_description(target, options.get("description")),
        skill_id=options.get("skill_id") or options.get("id") or resolved,
        roles=list(options.get("roles", [])),
        tags=list(options.get("tags", [])),
        input_modes=list(options.get("input_modes", [])),
        output_modes=list(options.get("output_modes", [])),
        examples=list(options.get("examples", [])),
        enabled=options.get("enabled", True),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_a2a_skill(spec)


def a2a_skill(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    skill_id: Optional[str] = None,
    id: Optional[str] = None,  # noqa: A002 - matches A2A spec field name
    roles: Optional[List[str]] = None,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    input_modes: Optional[List[str]] = None,
    output_modes: Optional[List[str]] = None,
    examples: Optional[List[str]] = None,
    enabled: bool = True,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as an A2A skill.

    The callable receives the inbound graph ``state`` (a dict, including the
    caller's text under ``input`` and identity under ``a2a_identity``) and
    returns either a string or a dict. ``roles`` is the RBAC allow-list enforced
    by :func:`authorize` before the skill runs.
    """
    return dual_decorator(_register_skill)(
        _target,
        name=name,
        skill_id=skill_id,
        id=id,
        roles=roles or [],
        description=description,
        tags=tags or [],
        input_modes=input_modes or [],
        output_modes=output_modes or [],
        examples=examples or [],
        enabled=enabled,
        metadata=metadata or {},
    )


def a2a_agent(
    name: str,
    *,
    agent_card_url: str = "",
    service: str = "",
    skill_id: str = "",
    roles: Optional[List[str]] = None,
    description: str = "",
    enabled: bool = True,
    metadata: Optional[dict] = None,
) -> A2AAgentSpec:
    """Register a remote A2A agent this app can delegate to.

    ``service`` optionally references an ``external_services`` entry so the
    outbound call reuses the SDK auth layer. Returns the spec for convenience.
    """
    spec = A2AAgentSpec(
        name=name,
        target=None,
        description=description,
        agent_card_url=agent_card_url,
        service=service,
        skill_id=skill_id,
        roles=list(roles or []),
        enabled=enabled,
        metadata=dict(metadata or {}),
    )
    get_registry().add_a2a_agent(spec)
    return spec


def a2a_authenticator(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
):
    """Register a custom inbound A2A authenticator.

    The decorated callable receives the request headers (a dict) and returns an
    :class:`A2AIdentity`, a plain dict (``subject`` / ``roles`` / ``scopes`` /
    ``claims``), or ``None`` to fall through to the static token table. Use this
    to verify JWTs (JWKS) or call an IdP introspection endpoint.
    """

    def wrap(target: Callable[..., Any]) -> Callable[..., Any]:
        spec = A2AAuthenticatorSpec(
            name=resolve_name(target, name),
            target=target,
            description=resolve_description(target, description),
        )
        get_registry().set_a2a_authenticator(spec)
        return target

    if _target is not None:
        return wrap(_target)
    return wrap
