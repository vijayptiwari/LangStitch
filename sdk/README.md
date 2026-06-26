# LangStitch SDK

A small, batteries-included Python SDK for building LangGraph applications with a
clean, conventional project structure. You describe components with decorators,
configure the app with YAML, and run it with one command.

```bash
pip install langstitch            # core (PyYAML only)
pip install "langstitch[all]"     # + FastAPI server + LangGraph
```

### Use it as a dependency

In your `pyproject.toml`:

```toml
[project]
dependencies = [
  "langstitch>=0.1.0",            # from PyPI
  # extras: "langstitch[server,graph,llm,http]>=0.1.0"
]
```

Before the PyPI release is live you can depend on it straight from Git:

```toml
[project]
dependencies = [
  "langstitch @ git+https://github.com/vijayptiwari/LangStitch.git#subdirectory=sdk",
]
```

## Quick start

```bash
langstitch new my-agent
cd my-agent
pip install -e .
python -m app          # bootstrap + print app info
langstitch run         # start the API server
```

## Decorators

| Decorator | Purpose |
| --- | --- |
| `@graph_node` | Register a node handler (`state -> dict`). |
| `@graph` | Register a graph builder (`entrypoint=True` for the root, `parent=...` for subgraphs). |
| `@skill` | Register a reusable capability. |
| `@input_guardrail` / `@output_guardrail` | Validate inbound requests / outbound responses. |
| `@business_policy` | Register an organizational rule (evaluated by `priority`). |
| `@persona` | Register an agent identity / system prompt. |
| `@configuration` | Bind a section of `application.yaml` to a dataclass. |
| `@langstitch_graph_server` | Turn a class into a runnable graph API server (`protocol`, `port`, `name`, `properties`). |
| `@tool` | Register a callable an LLM can invoke (`roles`, `tags`, `input_schema`). |
| `@worker_agent` | Register a delegatable sub-agent (`role`, `tools`, `persona`). |
| `@langstitch_mcp_server` | Mark the MCP server class + transport (`protocol="stdio"\|"sse"\|"streamable-http"\|"http"\|"websocket"`, `properties`). |
| `@mcp_tool` | Expose a callable as an MCP tool (`name`, `roles`, `description`). |
| `@mcp_resource` | Expose a readable MCP resource (`name`, `uri`, `mime_type`). |
| `@mcp_prompt` | Expose a reusable MCP prompt (`name`, `description`, `arguments`). |

Every decorator works bare or parameterized:

```python
from langstitch import skill

@skill
def echo(text: str) -> str:
    return text

@skill(name="search", tools=["web"], tags=["retrieval"])
def web_search(query: str) -> list[str]:
    ...
```

## Configuration

Two YAML files at the project root drive an app:

- **`application.yaml`** — application configuration (app metadata, model, graph, server, custom sections).
- **`env.yaml`** — runtime environment variables, exported into `os.environ` (existing values win unless `override=True`). Nested keys flatten to `UPPER_SNAKE` (`openai.api_key` → `OPENAI_API_KEY`).

```python
from langstitch import load_config

cfg = load_config()          # loads env.yaml then application config
print(cfg.name, cfg.get("server.port"))
```

### Precompiled in-memory config + JSON-path lookups

At startup `load_config()` parses the application config **once** into an
in-memory object (the runtime store). Use `get_config(path)` to read from it
with a JSON-path-lite syntax (dotted keys, `[index]`, optional leading `$`):

```python
from langstitch import get_config

get_config()                                    # the whole AppConfig
get_config("server.port")                       # -> 9001  (scalar)
get_config("model")                             # -> {...}  (nested object)
get_config("external_services.payments.auth.type")
get_config("items[0].name")                     # array index
get_config("missing.key", default="fallback")
get_config("server", as_json=True)              # -> '{"host": ...}'  (JSON string)
```

If you keep the config as **`application.json`** it's loaded directly (no
YAML→JSON conversion) and `application.json` takes precedence over
`application.yaml`. Precompile once for fast startup:

```bash
langstitch compile           # application.yaml -> application.json
langstitch get server.port   # resolve a path from the CLI
```

Both server decorators accept `properties=` to pin the config file loaded at
startup (relative to the project root, or absolute). When omitted, discovery is
used (`application.json` preferred, else `application.yaml`):

```python
@langstitch_graph_server(name="api", properties="application.yaml")   # pin YAML
class Server: ...

@langstitch_mcp_server(protocol="stdio")   # default: application.json then yaml
class MCPServer: ...
```

```python
from dataclasses import dataclass
from langstitch import configuration

@configuration(section="server")
@dataclass
class ServerConfig:
    host: str = "0.0.0.0"
    port: int = 8000

# after load_config(): ServerConfig._langstitch_instance is populated
```

## Base runtime helpers

Factory functions that read `application.yaml` / `env.yaml` so app code never
hand-builds clients:

```python
from langstitch import (
    get_config, get_env, get_secret, get_logger,
    get_llm_provider, get_http_client, get_async_http_client,
)

cfg = get_config()                       # cached AppConfig
log = get_logger(__name__)               # level from LOG_LEVEL
llm = get_llm_provider()                 # chat model from model: section (needs [llm])
http = get_http_client()                 # httpx.Client from http: section (needs [http])
key = get_secret("openai_api_key")       # env lookup with sensible fallbacks
```

Heavy deps are optional extras: `pip install "langstitch[llm]"` (LangChain) and
`pip install "langstitch[http]"` (httpx). Without them the helpers raise a clear
install hint. The same helpers are available as methods on `LangStitchApp`
(`app.get_llm_provider()`, `app.get_http_client()`, ...).

### External services & `get_http_client("<service>")`

Declare downstream HTTP services in `application.yaml`:

```yaml
external_services:
  payments:
    serverUrl: https://api.payments.com   # or server_url
    basePath: /v1                          # or base_path
    timeout: 30
    propagate_headers: [x-request-id, authorization]
    auth:
      type: bearer                         # none | basic | bearer | api_key | oauth2
      token: ${PAYMENTS_TOKEN}
```

```python
from langstitch import get_http_client, set_request_headers

# In request middleware, record inbound headers once:
set_request_headers(request.headers)

api = get_http_client("payments")   # base_url, timeout, auth + propagated headers wired in
```

The returned `ServiceClient` covers all HTTP verbs with `{path}` templating and
per-request header/query merging (auth + propagated headers stay applied):

```python
api.get("/users/{id}", path_params={"id": 7}, params={"expand": "wallet"})
api.post("/users", json={"name": "Ada"}, headers={"X-Trace": "1"})
api.put("/users/{id}", path_params={"id": 7}, json={...})
api.patch("/users/{id}", path_params={"id": 7}, json={...})
api.delete("/users/{id}", path_params={"id": 7})
api.request("OPTIONS", "/users")

api.set_header("X-Tenant", "acme")      # mutate default headers
api.add_headers({"X-Region": "eu"})
```

`get_async_http_client("payments")` returns the awaitable `AsyncServiceClient`
equivalent. Pass `raw=True` to either for the underlying httpx client.

Auth types and their options (string values support `${ENV_VAR}` interpolation):

| `auth.type` | Options | Effect |
| --- | --- | --- |
| `none` | — | no credentials |
| `basic` | `username`, `password` | `Authorization: Basic <b64>` |
| `bearer` | `token` | `Authorization: Bearer <token>` |
| `api_key` | `name` (default `X-API-Key`), `value`, `in` (`header`\|`query`) | header or query param |
| `oauth2` | `token_url`, `client_id`, `client_secret`, `scope?`, `audience?` | client-credentials; token fetched + cached/refreshed automatically |

`propagate_headers` forwards the listed inbound request headers (case-insensitive)
onto the outbound client. `get_async_http_client("<service>")` is the async variant.

## Dynamic registries & graph-server internal tools

Tools and worker agents are **not eagerly loaded** when a request arrives. The
registries hold cheap *specs* and refresh themselves automatically when anything
new registers (and on demand via `refresh_registries()`); the actual callables
are materialized only when a node selects them.

The graph server exposes introspection helpers (each hits the live registries):

```python
Server.get_all_tools()          # [ToolSpec, ...]
Server.get_all_worker_agents()  # [AgentSpec, ...]
Server.get_input_guardrails()
Server.get_output_guardrails()
Server.get_skills(); Server.get_policies(); Server.get_personas()
Server.get_tool("now"); Server.get_worker_agent("researcher")
Server.refresh_registries()
```

The same accessors are module-level functions (`langstitch.get_all_tools()`, ...).

## Hierarchical context (no parent pollution)

Every LLM call or sub-agent call runs in a **temporary child context**. The child
can accumulate tool-call messages and scratch reasoning freely; when the call
finishes, **only the final output** is merged back into the parent — so parents
stay small no matter how deep the call tree gets.

```python
from langstitch import Context, run_llm, run_worker_agent

ctx = Context(data={"question": "..."}, messages=[...])

def call_model(llm_ctx):
    # llm_ctx.tools were selected (by tag/name/role) and materialized just for
    # this call; llm_ctx.system holds the resolved persona.
    return model.invoke(llm_ctx.messages, tools=llm_ctx.tools)

answer = run_llm(ctx, call_model, persona="assistant", tool_tags=["search"], key="answer")
# ctx.data["answer"] is set; the child's tool traffic + scratch were discarded.

# Delegate to a sub-agent (runs with only its allowed tools, isolated context):
findings = run_worker_agent(ctx, "researcher", carry=["question"])
```

`ContextBuilder` does the lazy selection; `Context.scope(...)` / `ContextScope`
give you the raw building blocks if you need finer control.

## Building & running a graph

```python
from langstitch import LangStitchApp

app = LangStitchApp.bootstrap()
graph = app.build_graph()           # compiles to a LangGraph StateGraph
result = app.invoke({"messages": [{"role": "user", "content": "hi"}]})
```

## CLI

```text
langstitch new <name> [--dir PATH] [--force]   scaffold a project
langstitch info [--root PATH]                   load config + list components
langstitch run [--root PATH] [--host] [--port]  start the API server
langstitch version
```

## Status

Phase 1 (initial release): decorators, registry, YAML config, scaffolding CLI,
and an optional FastAPI server. LangGraph and FastAPI are optional extras so the
core stays lightweight and importable anywhere (including codegen).
