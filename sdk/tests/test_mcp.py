"""MCP decorators register server/tool/resource/prompt specs."""
from langstitch import (
    get_registry,
    langstitch_mcp_server,
    mcp_prompt,
    mcp_resource,
    mcp_tool,
)


def test_mcp_server_and_protocol():
    @langstitch_mcp_server(protocol="streamable-http", port=9100)
    class MyServer:
        """My MCP server."""

    spec = get_registry().mcp_server
    assert spec is not None
    assert spec.name == "MyServer"
    assert spec.protocol == "streamable-http"
    assert spec.port == 9100
    assert MyServer._langstitch_mcp_server is spec


def test_mcp_tool_roles_and_bare():
    @mcp_tool
    def plain(x):
        return x

    @mcp_tool(name="search", roles=["admin", "user"], description="Search the web.")
    def web(q):
        return [q]

    reg = get_registry()
    assert "plain" in reg.mcp_tools
    assert reg.mcp_tools["search"].roles == ["admin", "user"]
    assert reg.mcp_tools["search"].description == "Search the web."
    # transparent
    assert web("hi") == ["hi"]


def test_mcp_resource_uri():
    @mcp_resource(name="cfg", uri="config://app", mime_type="application/json")
    def cfg():
        return {"ok": True}

    spec = get_registry().mcp_resources["cfg"]
    assert spec.uri == "config://app"
    assert spec.mime_type == "application/json"


def test_mcp_prompt_arguments():
    @mcp_prompt(name="greet", description="Greeting", arguments=["name"])
    def greet(name="there"):
        return f"hi {name}"

    spec = get_registry().mcp_prompts["greet"]
    assert spec.arguments == ["name"]
    assert spec.description == "Greeting"


def test_registry_summary_includes_mcp():
    @langstitch_mcp_server(protocol="sse")
    class S:
        pass

    @mcp_tool(name="t")
    def t():
        return 1

    summary = get_registry().summary()
    assert summary["mcp_server"] == "S"
    assert "t" in summary["mcp_tools"]
