# LangStitch SDK

A small, batteries-included Python SDK for building LangGraph applications with a
clean, conventional project structure. You describe components with decorators,
configure the app with YAML, and run it with one command.

```bash
pip install langstitch            # core (PyYAML only)
pip install "langstitch[all]"     # + FastAPI server + LangGraph
```

> **Prefer a visual workflow?** The LangStitch IDE ships an **SDK Component Designer** for
> authoring custom nodes, connectors, and adaptors without writing registration code — define
> ports, a typed config schema, and a safe Python codegen template, then export the component as
> a portable `.component.json` or publish it to the
> [marketplace](https://marketplace.langstitch.com). See the
> [Component Designer docs](https://langstitch.com/docs/#components). This README covers the
> **code-first Python SDK**.

### Use it as a dependency

In your `pyproject.toml`:

```toml
[project]
dependencies = [
  "langstitch-sdk>=0.2.0",        # from PyPI
  # extras: "langstitch[server,graph,llm,http]>=0.1.0"
]
```

Before the PyPI release is live you can depend on it straight from Git:

```toml
[project]
dependencies = [
  "langstitch-sdk @ git+https://github.com/LangStitch/langstitch-sdk.git",
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
| `@worker_agent` | Register a delegatable local sub-agent (`role`, `tools`, `persona`). |
| `@agent` | Register a delegatable agent of any `transport` (`local`/`remote`/`a2a`), with `roles` for delegation RBAC. |
| `@supervisor` | Register a router over member `agents` (the supervisor pattern; `router="llm"\|"custom"`). |
| `@langstitch_mcp_server` | Mark the MCP server class + transport (`protocol="stdio"\|"sse"\|"streamable-http"\|"http"\|"websocket"`, `properties`). |
| `@mcp_tool` | Expose a callable as an MCP tool (`name`, `roles`, `description`). |
| `@mcp_resource` | Expose a readable MCP resource (`name`, `uri`, `mime_type`). |
| `@mcp_prompt` | Expose a reusable MCP prompt (`name`, `description`, `arguments`). |
| `@langstitch_a2a_server` | Publish the app as an Agent-to-Agent (A2A) agent behind auth + RBAC (`auth_required`, `rbac_enabled`, `url`, `port`, `properties`). |
| `@a2a_skill` | Expose an A2A skill advertised in the Agent Card (`skill_id`, `roles`, `tags`, `examples`). |
| `@a2a_agent` | Register a remote A2A agent this app can call (`agent_card_url`, `service`, `roles`). |
| `@a2a_authenticator` | Plug in a custom inbound A2A credential verifier (JWT/JWKS, IdP introspection). |

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

## Multi-agent systems (local, remote, A2A)

Agents are registered as `AgentSpec` records and delegated to uniformly via
`run_agent`, regardless of where they run. RBAC `roles` on each agent gate who
may delegate; remote/A2A auth reuses the services layer.

```python
from langstitch import agent, remote_agent, run_agent

# Local sub-agent (a callable):
@agent(tools=["web"], roles=["analyst"])
def researcher(state: dict) -> dict:
    return {"findings": "..."}

# Remote graph (HTTP /invoke) — auth via an external_services entry:
remote_agent("legal", url="/invoke", service="legal_svc", roles=["counsel"])

# A2A peer — url is the Agent Card; auth via service or env bearer:
agent(name="billing", transport="a2a",
      url="https://billing/.well-known/agent.json", service="billing_a2a")

# One call dispatches to the right transport; caller_roles enables RBAC:
out = run_agent({"input": "review contract"}, "legal", caller_roles=["counsel"])
```

`run_agent` raises `AgentDelegationError` (`403` denied / `404` unknown). Pass a
`Context` via `ctx=` to run a *local* agent in an isolated child context (see
`run_worker_agent`).

### Supervisor pattern (routing)

```python
from langstitch import supervisor, get_supervisor

@supervisor(agents=["researcher", "legal"], router="custom")
def triage(state) -> str:                     # returns the next agent name
    return "legal" if state.get("contract") else "researcher"

# router="llm" (default) lets an LLM pick the next agent from the member list.

team = get_supervisor("triage").build()       # a GraphBuilder wiring the team
graph = team.compile()                         # needs the `graph` extra
```

The supervisor routes with LangGraph `Command(goto=...)`; members return control
to the supervisor until it routes to `finish` (defaults to `END`).

### Swarm pattern (handoffs)

```python
from langstitch import graph_node, handoff, make_handoff_tool

@graph_node
def intake(state):
    return handoff("billing", update={"reason": "refund"})   # -> Command(goto=...)

transfer = make_handoff_tool("legal")   # an LLM-invokable handoff tool (swarm)
```

`handoff()` / `Supervisor.route()` build real `Command` objects and require the
`graph` (LangGraph) extra; the decorators and routing *decisions* (`choose`)
work without it.

## Agent-to-Agent (A2A) over the auth + RBAC layers

The SDK can both **publish** the app as an [A2A](https://a2a-protocol.org) agent
and **consume** other A2A agents — reusing the same auth and RBAC layers as the
rest of the SDK.

### Publish: serve your app as an A2A agent

`@langstitch_a2a_server` exposes an Agent Card at `/.well-known/agent.json` and
answers JSON-RPC `message/send` calls. Each `@a2a_skill` is advertised in the
card and carries a `roles` allow-list (an empty list = unrestricted, the same
convention used by tools/MCP).

```python
from langstitch import langstitch_a2a_server, a2a_skill

@langstitch_a2a_server(title="Billing Agent", url="https://billing.acme.com/")
class BillingAgent:
    ...

@a2a_skill(skill_id="refund", roles=["billing"], tags=["payments"])
def refund(state: dict) -> dict:
    # state has: input (caller text), message, metadata, a2a_identity
    caller = state["a2a_identity"]["subject"]
    return {"output": f"refund processed for {caller}"}

# BillingAgent.serve()   # run with uvicorn (needs the `server` extra)
```

The **auth layer** (who is calling) and **RBAC layer** (may they call this
skill) are configured under `a2a.server` and enforced on every request:

```yaml
a2a:
  server:
    auth:
      required: true
      scheme: bearer                 # bearer | api_key
      tokens:                        # static credential -> identity table
        ${BILLING_PEER_TOKEN}:
          subject: orders-agent
          roles: [billing]
    rbac:
      enabled: true
      default_roles: [guest]         # granted to anonymous callers when auth is optional
```

- Inbound credentials are resolved to an `A2AIdentity` by `authenticate()`
  (a `401` is returned when a required credential is missing/invalid).
- `authorize()` then checks the caller's roles against the skill's `roles`
  (a `403` when denied); unknown/disabled skills return `404`.
- The Agent Card is RBAC-filtered to the caller's visible skills once
  authenticated, and the inbound `Authorization` header is propagated onto
  downstream `external_services` calls.

For real identity providers, replace the static token table with a verifier:

```python
from langstitch import a2a_authenticator

@a2a_authenticator
def verify(headers: dict):
    claims = decode_jwt(headers.get("authorization", ""))   # your JWKS check
    if not claims:
        return None                                         # fall through to token table
    return {"subject": claims["sub"], "roles": claims.get("roles", [])}
```

### Consume: call another A2A agent (auth via the services layer)

Outbound calls reuse the `external_services` auth (`bearer` / `basic` /
`api_key` / `oauth2` + header propagation). Reference a service for credentials,
or pass an agent card URL with a bearer token / env var directly.

```python
from langstitch import a2a_agent, a2a_client, invoke_a2a_agent

# Declare a remote agent that authenticates via an external_services entry:
a2a_agent("orders", agent_card_url="https://orders.acme.com/.well-known/agent.json",
          service="orders_a2a", roles=["billing"])

# One-shot call:
result = invoke_a2a_agent("create order #42", agent="orders", skill_id="create")

# Or keep a client for the card + multiple messages:
with a2a_client("orders") as client:
    card = client.get_agent_card()
    reply = client.send_message("status of #42", skill_id="status")
```

`async_a2a_client` / `ainvoke_a2a_agent` are the async equivalents. Both client
and server are pure-Python except for the lazily-imported `http` (httpx) and
`server` (FastAPI) extras.

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

## Tracing, logging & LangSmith

Optional observability via `langstitch.tracing` (install `pip install "langstitch[tracing]"`).

### Configuration

```yaml
# application.yaml
tracing:
  enabled: true
  project: my-agent-project
  log_format: json          # text | json
  register_on_build: true   # upsert LangSmith project on build_graph()
  trace_nodes: true
```

Environment variables (`LANGSMITH_API_KEY`, `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_PROJECT`) are applied automatically when tracing is enabled.

### Register a graph with LangSmith

```python
from langstitch import LangStitchApp, configure_tracing, register_graph

configure_tracing()
app = LangStitchApp.bootstrap()
app.build_graph()   # registers entrypoint when tracing.register_on_build is true
print(app.info()["registered_graphs"])
```

CLI:

```bash
langstitch register              # register entrypoint graph (needs app package)
langstitch register --describe-only   # metadata only, no LangGraph compile
```

### Runtime agent smoke test

The repo ships `runtime/basic_agent.py` — a minimal SDK graph with optional LangSmith registration:

```bash
python runtime/basic_agent.py
# {"ok": true, "tracing": {"registered": true, ...}}
```

## CLI

```text
langstitch new <name> [--dir PATH] [--force]   scaffold a project
langstitch info [--root PATH]                   load config + list components
langstitch run [--root PATH] [--host] [--port]  start the API server
langstitch register [--root PATH] [--describe-only]  LangSmith graph registration
langstitch compile                              application.yaml -> application.json
langstitch get <json.path>                      resolve config path
langstitch version
```

## Status

Phase 1 (initial release): decorators, registry, YAML config, scaffolding CLI,
and an optional FastAPI server. LangGraph and FastAPI are optional extras so the
core stays lightweight and importable anywhere (including codegen).
