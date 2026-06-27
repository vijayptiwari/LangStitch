"""Project scaffolding used by ``langstitch new``.

``build_scaffold(name)`` returns a ``{relative_path: file_contents}`` map for a
complete, runnable LangStitch project that uses this SDK. Keeping it as pure data
makes it trivial to test and to reuse from other tooling (e.g. the IDE codegen).
"""
from __future__ import annotations

import re
from typing import Dict

__all__ = ["build_scaffold", "slugify"]


def slugify(name: str) -> str:
    slug = re.sub(r"[^0-9a-zA-Z]+", "_", name).strip("_").lower()
    if not slug:
        slug = "app"
    if slug[0].isdigit():
        slug = f"app_{slug}"
    return slug


def build_scaffold(name: str) -> Dict[str, str]:
    pkg = "app"
    title = name.replace("_", " ").replace("-", " ").strip().title() or "LangStitch App"
    slug = slugify(name)

    files: Dict[str, str] = {}

    files["application.yaml"] = f"""# Application configuration — read by langstitch.load_config()
app:
  name: {slug}
  version: 0.1.0
  description: {title} built with the LangStitch SDK.

server:
  host: 0.0.0.0
  port: 8000

model:
  provider: openai
  name: gpt-4o-mini
  temperature: 0.2

http:
  timeout: 30

# Downstream HTTP services — get_http_client("<name>") wires these up.
external_services:
  example_api:
    serverUrl: https://api.example.com
    basePath: /v1
    timeout: 30
    propagate_headers: [x-request-id, authorization]
    auth:
      type: none          # none | basic | bearer | api_key | oauth2
      # bearer:  token: ${{EXAMPLE_API_TOKEN}}
      # api_key: name: X-API-Key, value: ${{EXAMPLE_API_KEY}}, in: header
      # basic:   username: ..., password: ${{EXAMPLE_API_PASSWORD}}
      # oauth2:  token_url: ..., client_id: ..., client_secret: ${{...}}, scope: ...

graph:
  entrypoint: main

tracing:
  enabled: false
  project: ${{app.name}}
  log_format: text
  register_on_build: true
  trace_nodes: true
"""

    files["env.yaml"] = """# Runtime environment variables — exported into os.environ by load_env().
# Do NOT commit real secrets; use this for local development only.
log_level: INFO

openai:
  api_key: "sk-replace-me"
"""

    files["pyproject.toml"] = f"""[project]
name = "{slug}"
version = "0.1.0"
description = "{title} built with the LangStitch SDK."
requires-python = ">=3.10"
dependencies = [
  "langstitch[server,graph]>=0.1.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["{pkg}"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
"""

    files[".gitignore"] = """__pycache__/
*.py[cod]
.venv/
venv/
.env
*.egg-info/
.pytest_cache/
"""

    files["README.md"] = f"""# {title}

Generated with the [LangStitch SDK](https://github.com/vijayptiwari/LangStitch).

## Setup

```bash
pip install -e .            # installs langstitch + this project
```

## Configure

- `application.yaml` — application configuration (models, graph, server).
- `env.yaml` — local runtime environment variables (keep secrets out of git).

## Run

```bash
python -m {pkg}             # bootstrap + print app info
langstitch run             # start the API server (needs langstitch[server])
```

## Project layout

```
{pkg}/
  graphs/      @graph        — the main graph (main.py) and subgraphs
  nodes/       @graph_node   — node handlers
  skills/      @skill        — reusable capabilities
  guardrails/  @input_guardrail / @output_guardrail
  policies/    @business_policy
  personas/    @persona
  config.py    @configuration — typed application.yaml sections
  main.py      @langstitch_graph_server — server + bootstrap
```
"""

    files[f"{pkg}/__init__.py"] = f'''"""{title} — LangStitch application package."""
# Import submodules so their decorators register on the global registry.
from . import config  # noqa: F401
from . import personas  # noqa: F401
from . import skills  # noqa: F401
from . import guardrails  # noqa: F401
from . import policies  # noqa: F401
from . import tools  # noqa: F401
from . import agents  # noqa: F401
from . import nodes  # noqa: F401
from . import graphs  # noqa: F401
from . import mcp  # noqa: F401
from . import main  # noqa: F401
'''

    files[f"{pkg}/state.py"] = '''"""Graph state schema."""
from __future__ import annotations

from typing import Annotated, TypedDict

try:
    from langgraph.graph.message import add_messages
except ImportError:  # SDK importable without the graph extra
    def add_messages(left, right):  # type: ignore
        return (left or []) + (right or [])


class State(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    response: str
'''

    files[f"{pkg}/config.py"] = '''"""Typed configuration bound from application.yaml."""
from __future__ import annotations

from dataclasses import dataclass

from langstitch import configuration


@configuration(section="server")
@dataclass
class ServerConfig:
    host: str = "0.0.0.0"
    port: int = 8000


@configuration(section="model")
@dataclass
class ModelConfig:
    provider: str = "openai"
    name: str = "gpt-4o-mini"
    temperature: float = 0.2
'''

    files[f"{pkg}/personas/__init__.py"] = "from . import assistant  # noqa: F401\n"
    files[f"{pkg}/personas/assistant.py"] = '''"""Default assistant persona."""
from __future__ import annotations

from langstitch import persona


@persona(role="assistant", tone="helpful, concise")
def assistant() -> str:
    """The system identity used by the agent."""
    return (
        "You are a helpful, concise assistant built with LangStitch. "
        "Answer accurately and ask for clarification when needed."
    )
'''

    files[f"{pkg}/skills/__init__.py"] = "from . import echo  # noqa: F401\n"
    files[f"{pkg}/skills/echo.py"] = '''"""Example skill."""
from __future__ import annotations

from langstitch import skill


@skill(description="Echo the user input back.", tags=["example"])
def echo(text: str) -> str:
    return text
'''

    files[f"{pkg}/guardrails/__init__.py"] = "from . import safety  # noqa: F401\n"
    files[f"{pkg}/guardrails/safety.py"] = '''"""Example input/output guardrails."""
from __future__ import annotations

from langstitch import input_guardrail, output_guardrail

MAX_INPUT_CHARS = 8000


@input_guardrail(description="Reject empty or oversized inputs.")
def non_empty_input(text: str) -> bool:
    return bool(text and len(text) <= MAX_INPUT_CHARS)


@output_guardrail(description="Ensure the response is non-empty.")
def non_empty_output(text: str) -> bool:
    return bool(text and text.strip())
'''

    files[f"{pkg}/policies/__init__.py"] = "from . import usage  # noqa: F401\n"
    files[f"{pkg}/policies/usage.py"] = '''"""Example business policy."""
from __future__ import annotations

from langstitch import business_policy


@business_policy(priority=100, description="Allow all requests by default.")
def allow_all(context: dict) -> dict:
    return {"decision": "allow"}
'''

    files[f"{pkg}/tools/__init__.py"] = "from . import examples  # noqa: F401\n"
    files[f"{pkg}/tools/examples.py"] = '''"""Example tools — lazily injected into LLM context when a node selects them."""
from __future__ import annotations

from langstitch import tool


@tool(description="Return the current UTC time.", tags=["time"])
def now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


@tool(description="Add two numbers.", tags=["math"], roles=["user"])
def add(a: float, b: float) -> float:
    return a + b
'''

    files[f"{pkg}/agents/__init__.py"] = "from . import examples  # noqa: F401\n"
    files[f"{pkg}/agents/examples.py"] = '''"""Example worker agent — runs in an isolated child context when delegated to."""
from __future__ import annotations

from langstitch import worker_agent


@worker_agent(
    role="researcher",
    description="Researches a focused sub-question.",
    tools=["now"],
    persona="assistant",
    tags=["research"],
)
def researcher(llm_ctx) -> str:
    # llm_ctx.tools are materialized + scoped to this agent only.
    question = ""
    if llm_ctx.messages:
        last = llm_ctx.messages[-1]
        question = last.get("content", "") if isinstance(last, dict) else str(last)
    return f"(researcher) findings for: {question}"
'''

    files[f"{pkg}/nodes/__init__.py"] = "from . import respond  # noqa: F401\n"
    files[f"{pkg}/nodes/respond.py"] = f'''"""Primary node handler.

Demonstrates hierarchical context: the LLM call runs in an isolated child
context (tools selected + materialized just-in-time), and only the final reply is
merged back into the parent context — internal tool traffic never leaks upward.
"""
from __future__ import annotations

from langstitch import Context, get_llm_provider, get_logger, graph_node, run_llm

log = get_logger(__name__)


@graph_node(description="Produce a response for the latest user message.")
def respond(state: dict) -> dict:
    messages = state.get("messages", [])
    last = messages[-1] if messages else {{"content": ""}}
    content = last.get("content", "") if isinstance(last, dict) else str(last)

    ctx = Context(data={{"messages": messages}}, messages=list(messages))

    def call_model(llm_ctx):
        # llm_ctx.system (persona), llm_ctx.tools (lazily injected) ready here.
        llm = get_llm_provider()
        return llm.invoke(
            [{{"role": "system", "content": llm_ctx.system}}]
            + [{{"role": "user", "content": content}}]
        )

    try:
        result = run_llm(
            ctx,
            call_model,
            persona="assistant",
            tool_tags=["time", "math"],  # only these tools are pulled + injected
            key="response",
            as_message="assistant",
        )
        reply = getattr(result, "content", str(result))
    except RuntimeError as exc:
        # LLM extra not installed — fall back to an echo so the graph still runs.
        log.warning("LLM unavailable (%s); using echo fallback", exc)
        reply = f"You said: {{content}}"

    return {{"response": reply, "messages": [{{"role": "assistant", "content": reply}}]}}
'''

    files[f"{pkg}/mcp/__init__.py"] = "from . import server  # noqa: F401\n"
    files[f"{pkg}/mcp/server.py"] = f'''"""MCP server exposing tools, resources, and prompts to MCP clients."""
from __future__ import annotations

from langstitch import (
    langstitch_mcp_server,
    mcp_prompt,
    mcp_resource,
    mcp_tool,
)


@langstitch_mcp_server(protocol="stdio", version="0.1.0")
class MCPServer:
    """{title} MCP server."""


@mcp_tool(name="echo", roles=["user"], description="Echo the provided text back.")
def echo_tool(text: str) -> str:
    return text


@mcp_resource(name="app_config", uri="config://app", description="Application configuration summary.")
def app_config() -> dict:
    from langstitch import load_config

    cfg = load_config()
    return {{"name": cfg.name, "version": cfg.version}}


@mcp_prompt(name="greeting", description="A friendly greeting prompt.", arguments=["name"])
def greeting_prompt(name: str = "there") -> str:
    return f"Hello {{name}}! How can I help you today?"
'''

    files[f"{pkg}/graphs/__init__.py"] = "from . import main  # noqa: F401\n"
    files[f"{pkg}/graphs/main.py"] = f'''"""Main graph — wires nodes into a runnable StateGraph."""
from __future__ import annotations

from langstitch import END, START, GraphBuilder, graph

from {pkg}.nodes.respond import respond
from {pkg}.state import State


@graph(name="main", entrypoint=True, description="Top-level conversation graph.")
def main_graph() -> GraphBuilder:
    builder = GraphBuilder("main", state_schema=State)
    builder.add_node("respond", respond)
    builder.set_entry_point("respond")
    builder.add_edge("respond", END)
    return builder
'''

    files[f"{pkg}/main.py"] = f'''"""Application entrypoint and server."""
from __future__ import annotations

from langstitch import LangStitchApp, langstitch_graph_server


# properties=None -> loads application.json (preferred) or application.yaml from
# the project root. Pass e.g. properties="application.yaml" to pin a file.
@langstitch_graph_server(name="{slug}", protocol="http", port=8000, properties=None)
class Server:
    """Graph API server for {title}."""


def bootstrap() -> LangStitchApp:
    # Importing the package registers every decorated component.
    import {pkg}  # noqa: F401

    return LangStitchApp.bootstrap(properties=Server._langstitch_server.properties)


if __name__ == "__main__":
    import json

    app = bootstrap()
    print(json.dumps(app.info(), indent=2))
'''

    files[f"{pkg}/__main__.py"] = f'''from {pkg}.main import bootstrap

if __name__ == "__main__":
    import json

    print(json.dumps(bootstrap().info(), indent=2))
'''

    files["tests/test_smoke.py"] = f'''"""Smoke test: components register and the graph wires up."""
from __future__ import annotations

import {pkg}  # noqa: F401  (triggers registration)
from langstitch import get_registry


def test_components_register():
    reg = get_registry()
    assert "respond" in reg.nodes
    assert "main" in reg.graphs
    assert "echo" in reg.skills
    assert reg.input_guardrails and reg.output_guardrails
    assert reg.policies and reg.personas
    assert reg.server is not None
    assert "now" in reg.tools
    assert "researcher" in reg.worker_agents
    assert reg.mcp_server is not None
    assert "echo" in reg.mcp_tools
    assert "app_config" in reg.mcp_resources
    assert "greeting" in reg.mcp_prompts


def test_dynamic_registries_and_context():
    from langstitch import Context, get_all_tools, get_all_worker_agents, run_worker_agent

    assert {{t.name for t in get_all_tools()}} >= {{"now", "add"}}
    assert any(a.name == "researcher" for a in get_all_worker_agents())

    parent = Context(data={{"topic": "x"}}, messages=[{{"role": "user", "content": "hi"}}])
    out = run_worker_agent(parent, "researcher", carry=["topic"])
    # Only the agent's output is merged back; parent context stays clean.
    assert "researcher" in parent.data
    assert parent.data["researcher"].startswith("(researcher)")
    assert "messages" not in parent.data  # no internal leakage


def test_entrypoint_graph_builds():
    reg = get_registry()
    spec = reg.entrypoint_graph()
    assert spec is not None and spec.name == "main"
    builder = spec.target()
    described = builder.describe()
    assert "respond" in described["nodes"]
    assert described["entry"] == "respond"
'''

    return files
