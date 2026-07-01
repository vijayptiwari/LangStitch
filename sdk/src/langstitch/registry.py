"""Component specs and the global registry.

Every LangStitch decorator records a small, serializable *spec* describing the
decorated object plus a reference to the callable/class itself. Specs are stored
in a process-global :class:`Registry` so the runtime, server, and CLI can
discover everything an application defines without import-time side effects
beyond registration.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

__all__ = [
    "NodeSpec",
    "GraphSpec",
    "SkillSpec",
    "GuardrailSpec",
    "PolicySpec",
    "PersonaSpec",
    "ConfigurationSpec",
    "ServerSpec",
    "ToolSpec",
    "AgentSpec",
    "SupervisorSpec",
    "MCPServerSpec",
    "MCPToolSpec",
    "MCPResourceSpec",
    "MCPPromptSpec",
    "A2AServerSpec",
    "A2ASkillSpec",
    "A2AAgentSpec",
    "A2AAuthenticatorSpec",
    "Registry",
    "get_registry",
    "reset_registry",
]


@dataclass
class _BaseSpec:
    name: str
    target: Any  # the decorated callable or class
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def qualified_name(self) -> str:
        mod = getattr(self.target, "__module__", "")
        return f"{mod}.{self.name}" if mod else self.name


@dataclass
class NodeSpec(_BaseSpec):
    """A graph node handler: ``state -> dict``."""

    kind: str = "function"
    tags: List[str] = field(default_factory=list)


@dataclass
class GraphSpec(_BaseSpec):
    """A graph definition. ``target`` builds/returns a (compiled) graph."""

    entrypoint: bool = False
    parent: Optional[str] = None  # set for subgraphs


@dataclass
class SkillSpec(_BaseSpec):
    tools: List[str] = field(default_factory=list)
    persona: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class GuardrailSpec(_BaseSpec):
    stage: str = "input"  # "input" | "output"
    action: str = "block"  # block | warn | log
    severity: str = "medium"
    enabled: bool = True


@dataclass
class PolicySpec(_BaseSpec):
    priority: int = 0
    enabled: bool = True
    tags: List[str] = field(default_factory=list)


@dataclass
class PersonaSpec(_BaseSpec):
    role: str = ""
    tone: str = ""


@dataclass
class ConfigurationSpec(_BaseSpec):
    section: str = ""  # which application.yaml section binds to this class


@dataclass
class ServerSpec(_BaseSpec):
    title: str = "LangStitch App"
    version: str = "0.1.0"
    protocol: str = "http"  # http | grpc | websocket
    host: str = "0.0.0.0"
    port: int = 8000
    properties: Optional[str] = None  # config file path; None -> auto-discover


@dataclass
class ToolSpec(_BaseSpec):
    """A callable tool an LLM can invoke during a decision."""

    roles: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    input_schema: Optional[Dict[str, Any]] = None
    enabled: bool = True


@dataclass
class AgentSpec(_BaseSpec):
    """A delegatable agent — local, remote graph, or A2A.

    ``transport`` selects how it runs when delegated to via ``run_agent``:

    * ``local``  — ``target`` is invoked in-process (a worker sub-agent).
    * ``remote`` — an HTTP call to ``url`` (or an ``external_services`` entry
      named by ``service``) is made; auth reuses the SDK services layer.
    * ``a2a``    — delegated through the A2A client (see :mod:`langstitch.a2a`).

    ``roles`` is the RBAC allow-list gating *who may delegate to this agent*
    (empty = unrestricted, matching tools/MCP/A2A semantics).
    """

    role: str = ""
    tools: List[str] = field(default_factory=list)
    persona: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    enabled: bool = True
    transport: str = "local"  # local | remote | a2a
    url: str = ""
    service: str = ""  # external_services key supplying base_url + auth
    auth_env: str = ""  # env var holding a bearer token (when no service)
    roles: List[str] = field(default_factory=list)


@dataclass
class SupervisorSpec(_BaseSpec):
    """A supervisor that routes between member agents (the supervisor pattern).

    ``members`` are the names of the agents it can delegate to. ``router`` is
    ``llm`` (an LLM picks the next member from a structured choice) or ``custom``
    (the decorated callable returns the next member name). ``finish`` is the node
    to route to when the supervisor decides it is done (defaults to ``END``).
    """

    members: List[str] = field(default_factory=list)
    router: str = "llm"  # llm | custom
    model: str = ""
    persona: Optional[str] = None
    instructions: str = ""
    finish: str = "__end__"
    roles: List[str] = field(default_factory=list)
    enabled: bool = True


@dataclass
class MCPServerSpec(_BaseSpec):
    protocol: str = "stdio"  # stdio | sse | streamable-http | http | websocket
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8080
    properties: Optional[str] = None  # config file path; None -> auto-discover


@dataclass
class MCPToolSpec(_BaseSpec):
    roles: List[str] = field(default_factory=list)
    enabled: bool = True
    tags: List[str] = field(default_factory=list)


@dataclass
class MCPResourceSpec(_BaseSpec):
    uri: str = ""
    mime_type: str = "text/plain"
    roles: List[str] = field(default_factory=list)


@dataclass
class MCPPromptSpec(_BaseSpec):
    arguments: List[str] = field(default_factory=list)
    roles: List[str] = field(default_factory=list)


@dataclass
class A2AServerSpec(_BaseSpec):
    """The class that exposes this app as an Agent-to-Agent (A2A) agent.

    Mirrors :class:`ServerSpec` but for the A2A protocol: it advertises an Agent
    Card and answers JSON-RPC ``message/send`` calls. ``auth_required`` and
    ``rbac_enabled`` toggle the inbound auth and RBAC layers; ``default_roles``
    are granted to anonymous callers when auth is not required.
    """

    title: str = "LangStitch A2A Agent"
    version: str = "0.1.0"
    protocol_version: str = "0.2"
    host: str = "0.0.0.0"
    port: int = 8100
    url: str = ""  # public base URL advertised in the agent card
    auth_required: bool = True
    rbac_enabled: bool = True
    default_roles: List[str] = field(default_factory=list)
    streaming: bool = False
    properties: Optional[str] = None  # config file path; None -> auto-discover


@dataclass
class A2ASkillSpec(_BaseSpec):
    """A capability advertised in the Agent Card and invokable over A2A.

    ``roles`` is the RBAC allow-list: a caller must hold at least one of these
    roles to invoke the skill. An empty list means the skill is unrestricted
    (the same convention used by tool/MCP role selection).
    """

    skill_id: str = ""
    roles: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    input_modes: List[str] = field(default_factory=list)
    output_modes: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    enabled: bool = True


@dataclass
class A2AAgentSpec(_BaseSpec):
    """A remote A2A agent this application can call.

    ``service`` optionally references an ``external_services`` entry so the
    outbound call reuses the SDK auth layer (bearer/api_key/oauth2). ``roles``
    gates which local callers may delegate to this remote agent.
    """

    agent_card_url: str = ""
    service: str = ""  # external_services key supplying base_url + auth
    skill_id: str = ""
    roles: List[str] = field(default_factory=list)
    enabled: bool = True


@dataclass
class A2AAuthenticatorSpec(_BaseSpec):
    """A pluggable inbound authenticator for the A2A server.

    ``target`` is a callable ``(headers: dict) -> A2AIdentity | dict | None``
    used to verify inbound credentials (e.g. JWT/JWKS, an IdP introspection
    call) instead of the built-in static token table.
    """


class Registry:
    """Thread-safe container of all decorated components in an application."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.nodes: Dict[str, NodeSpec] = {}
        self.graphs: Dict[str, GraphSpec] = {}
        self.skills: Dict[str, SkillSpec] = {}
        self.input_guardrails: Dict[str, GuardrailSpec] = {}
        self.output_guardrails: Dict[str, GuardrailSpec] = {}
        self.policies: Dict[str, PolicySpec] = {}
        self.personas: Dict[str, PersonaSpec] = {}
        self.configurations: Dict[str, ConfigurationSpec] = {}
        self.tools: Dict[str, ToolSpec] = {}
        self.worker_agents: Dict[str, AgentSpec] = {}
        self.supervisors: Dict[str, SupervisorSpec] = {}
        self.server: Optional[ServerSpec] = None
        # Monotonic counter bumped on every mutation so dynamic registries can
        # detect staleness and refresh lazily.
        self.revision: int = 0
        self.mcp_tools: Dict[str, MCPToolSpec] = {}
        self.mcp_resources: Dict[str, MCPResourceSpec] = {}
        self.mcp_prompts: Dict[str, MCPPromptSpec] = {}
        self.mcp_server: Optional[MCPServerSpec] = None
        self.a2a_server: Optional[A2AServerSpec] = None
        self.a2a_skills: Dict[str, A2ASkillSpec] = {}
        self.a2a_agents: Dict[str, A2AAgentSpec] = {}
        self.a2a_authenticator: Optional[A2AAuthenticatorSpec] = None

    # ── registration ──
    def add_node(self, spec: NodeSpec) -> None:
        with self._lock:
            self.nodes[spec.name] = spec

    def add_graph(self, spec: GraphSpec) -> None:
        with self._lock:
            self.graphs[spec.name] = spec

    def add_skill(self, spec: SkillSpec) -> None:
        with self._lock:
            self.skills[spec.name] = spec

    def add_guardrail(self, spec: GuardrailSpec) -> None:
        with self._lock:
            if spec.stage == "output":
                self.output_guardrails[spec.name] = spec
            else:
                self.input_guardrails[spec.name] = spec
            self.revision += 1

    def add_tool(self, spec: ToolSpec) -> None:
        with self._lock:
            self.tools[spec.name] = spec
            self.revision += 1

    def add_worker_agent(self, spec: AgentSpec) -> None:
        with self._lock:
            self.worker_agents[spec.name] = spec
            self.revision += 1

    def add_supervisor(self, spec: SupervisorSpec) -> None:
        with self._lock:
            self.supervisors[spec.name] = spec
            self.revision += 1

    def add_policy(self, spec: PolicySpec) -> None:
        with self._lock:
            self.policies[spec.name] = spec

    def add_persona(self, spec: PersonaSpec) -> None:
        with self._lock:
            self.personas[spec.name] = spec

    def add_configuration(self, spec: ConfigurationSpec) -> None:
        with self._lock:
            self.configurations[spec.name] = spec

    def set_server(self, spec: ServerSpec) -> None:
        with self._lock:
            self.server = spec

    def add_mcp_tool(self, spec: MCPToolSpec) -> None:
        with self._lock:
            self.mcp_tools[spec.name] = spec

    def add_mcp_resource(self, spec: MCPResourceSpec) -> None:
        with self._lock:
            self.mcp_resources[spec.name] = spec

    def add_mcp_prompt(self, spec: MCPPromptSpec) -> None:
        with self._lock:
            self.mcp_prompts[spec.name] = spec

    def set_mcp_server(self, spec: MCPServerSpec) -> None:
        with self._lock:
            self.mcp_server = spec

    def set_a2a_server(self, spec: A2AServerSpec) -> None:
        with self._lock:
            self.a2a_server = spec

    def add_a2a_skill(self, spec: A2ASkillSpec) -> None:
        with self._lock:
            self.a2a_skills[spec.name] = spec
            self.revision += 1

    def add_a2a_agent(self, spec: A2AAgentSpec) -> None:
        with self._lock:
            self.a2a_agents[spec.name] = spec
            self.revision += 1

    def set_a2a_authenticator(self, spec: A2AAuthenticatorSpec) -> None:
        with self._lock:
            self.a2a_authenticator = spec

    # ── lookups ──
    def entrypoint_graph(self) -> Optional[GraphSpec]:
        explicit = [g for g in self.graphs.values() if g.entrypoint]
        if explicit:
            return explicit[0]
        roots = [g for g in self.graphs.values() if g.parent is None]
        return roots[0] if len(roots) == 1 else (roots[0] if roots else None)

    def summary(self) -> Dict[str, Any]:
        return {
            "nodes": sorted(self.nodes),
            "graphs": sorted(self.graphs),
            "skills": sorted(self.skills),
            "input_guardrails": sorted(self.input_guardrails),
            "output_guardrails": sorted(self.output_guardrails),
            "policies": sorted(self.policies),
            "personas": sorted(self.personas),
            "configurations": sorted(self.configurations),
            "tools": sorted(self.tools),
            "worker_agents": sorted(self.worker_agents),
            "supervisors": sorted(self.supervisors),
            "server": self.server.name if self.server else None,
            "mcp_server": self.mcp_server.name if self.mcp_server else None,
            "mcp_tools": sorted(self.mcp_tools),
            "mcp_resources": sorted(self.mcp_resources),
            "mcp_prompts": sorted(self.mcp_prompts),
            "a2a_server": self.a2a_server.name if self.a2a_server else None,
            "a2a_skills": sorted(self.a2a_skills),
            "a2a_agents": sorted(self.a2a_agents),
        }

    def clear(self) -> None:
        with self._lock:
            self.nodes.clear()
            self.graphs.clear()
            self.skills.clear()
            self.input_guardrails.clear()
            self.output_guardrails.clear()
            self.policies.clear()
            self.personas.clear()
            self.configurations.clear()
            self.tools.clear()
            self.worker_agents.clear()
            self.supervisors.clear()
            self.server = None
            self.mcp_tools.clear()
            self.mcp_resources.clear()
            self.mcp_prompts.clear()
            self.mcp_server = None
            self.a2a_server = None
            self.a2a_skills.clear()
            self.a2a_agents.clear()
            self.a2a_authenticator = None
            self.revision += 1


_REGISTRY = Registry()


def get_registry() -> Registry:
    """Return the process-global registry."""
    return _REGISTRY


def reset_registry() -> None:
    """Clear the global registry (primarily for tests)."""
    _REGISTRY.clear()
