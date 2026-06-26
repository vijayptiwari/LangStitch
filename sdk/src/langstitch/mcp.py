"""MCP (Model Context Protocol) decorators.

Expose application capabilities to MCP clients:

* ``@langstitch_mcp_server(protocol=...)`` — mark the class that hosts the MCP
  server and choose its transport protocol.
* ``@mcp_tool(name=..., roles=[...], description=...)`` — register a callable as
  an MCP tool.
* ``@mcp_resource(name=..., uri=...)`` — register a readable MCP resource.
* ``@mcp_prompt(name=..., description=...)`` — register a reusable MCP prompt.

Like the rest of the SDK these only record specs on the global registry; the
optional server runtime wires them into a real MCP server.
"""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from ._decorators import dual_decorator, resolve_description, resolve_name
from .registry import (
    MCPPromptSpec,
    MCPResourceSpec,
    MCPServerSpec,
    MCPToolSpec,
    get_registry,
)

__all__ = [
    "langstitch_mcp_server",
    "mcp_tool",
    "mcp_resource",
    "mcp_prompt",
]


def langstitch_mcp_server(
    _target: Any = None,
    /,
    *,
    protocol: str = "stdio",
    name: Optional[str] = None,
    version: str = "0.1.0",
    host: str = "0.0.0.0",
    port: int = 8080,
    description: Optional[str] = None,
    properties: Optional[str] = None,
):
    """Mark a class as the application's MCP server.

    ``protocol`` selects the transport: ``stdio`` (default), ``sse``,
    ``streamable-http``, ``http``, or ``websocket``. ``properties`` is the
    relative/absolute path to the config file loaded on startup; when omitted the
    runtime uses ``application.json`` at the project root (falling back to
    ``application.yaml``). A ``load_config()`` classmethod is attached.
    """

    def wrap(cls: Any) -> Any:
        spec = MCPServerSpec(
            name=resolve_name(cls, name),
            target=cls,
            description=resolve_description(cls, description),
            protocol=protocol,
            version=version,
            host=host,
            port=port,
            properties=properties,
        )
        get_registry().set_mcp_server(spec)

        def _load_config(_cls):  # noqa: ANN001
            from .config import load_config

            return load_config(properties=spec.properties)

        cls.load_config = classmethod(_load_config)
        cls._langstitch_mcp_server = spec
        return cls

    if _target is not None:
        return wrap(_target)
    return wrap


def _register_tool(target: Callable[..., Any], options: dict) -> None:
    spec = MCPToolSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        roles=list(options.get("roles", [])),
        enabled=options.get("enabled", True),
        tags=list(options.get("tags", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_mcp_tool(spec)


def mcp_tool(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    roles: Optional[List[str]] = None,
    description: Optional[str] = None,
    enabled: bool = True,
    tags: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as an MCP tool.

    ``roles`` is an optional access-control list of role names allowed to invoke
    the tool.
    """
    return dual_decorator(_register_tool)(
        _target,
        name=name,
        roles=roles or [],
        description=description,
        enabled=enabled,
        tags=tags or [],
        metadata=metadata or {},
    )


def _register_resource(target: Callable[..., Any], options: dict) -> None:
    spec = MCPResourceSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        uri=options.get("uri", ""),
        mime_type=options.get("mime_type", "text/plain"),
        roles=list(options.get("roles", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_mcp_resource(spec)


def mcp_resource(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    uri: str = "",
    description: Optional[str] = None,
    mime_type: str = "text/plain",
    roles: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as a readable MCP resource.

    ``uri`` is the resource identifier clients use to fetch it (e.g.
    ``config://app`` or ``file://docs/readme``).
    """
    return dual_decorator(_register_resource)(
        _target,
        name=name,
        uri=uri,
        description=description,
        mime_type=mime_type,
        roles=roles or [],
        metadata=metadata or {},
    )


def _register_prompt(target: Callable[..., Any], options: dict) -> None:
    spec = MCPPromptSpec(
        name=resolve_name(target, options.get("name")),
        target=target,
        description=resolve_description(target, options.get("description")),
        arguments=list(options.get("arguments", [])),
        roles=list(options.get("roles", [])),
        metadata=dict(options.get("metadata", {})),
    )
    get_registry().add_mcp_prompt(spec)


def mcp_prompt(
    _target: Optional[Callable[..., Any]] = None,
    /,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    arguments: Optional[List[str]] = None,
    roles: Optional[List[str]] = None,
    metadata: Optional[dict] = None,
):
    """Register the decorated callable as a reusable MCP prompt template."""
    return dual_decorator(_register_prompt)(
        _target,
        name=name,
        description=description,
        arguments=arguments or [],
        roles=roles or [],
        metadata=metadata or {},
    )
