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
    "MCPServerSpec",
    "MCPToolSpec",
    "MCPResourceSpec",
    "MCPPromptSpec",
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
    """A worker (sub) agent that can be delegated to from a node."""

    role: str = ""
    tools: List[str] = field(default_factory=list)
    persona: Optional[str] = None
    tags: List[str] = field(default_factory=list)
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
        self.server: Optional[ServerSpec] = None
        # Monotonic counter bumped on every mutation so dynamic registries can
        # detect staleness and refresh lazily.
        self.revision: int = 0
        self.mcp_tools: Dict[str, MCPToolSpec] = {}
        self.mcp_resources: Dict[str, MCPResourceSpec] = {}
        self.mcp_prompts: Dict[str, MCPPromptSpec] = {}
        self.mcp_server: Optional[MCPServerSpec] = None

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
            "server": self.server.name if self.server else None,
            "mcp_server": self.mcp_server.name if self.mcp_server else None,
            "mcp_tools": sorted(self.mcp_tools),
            "mcp_resources": sorted(self.mcp_resources),
            "mcp_prompts": sorted(self.mcp_prompts),
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
            self.server = None
            self.mcp_tools.clear()
            self.mcp_resources.clear()
            self.mcp_prompts.clear()
            self.mcp_server = None
            self.revision += 1


_REGISTRY = Registry()


def get_registry() -> Registry:
    """Return the process-global registry."""
    return _REGISTRY


def reset_registry() -> None:
    """Clear the global registry (primarily for tests)."""
    _REGISTRY.clear()
