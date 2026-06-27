# LangStitch

**LangStitch** is a visual, drag-and-drop IDE for building [LangGraph](https://langchain-ai.github.io/langgraph/) workflows — with asset designers, RAG pipelines, Python 3.13 multi-module export, git sync, Docker, and Kubernetes/Helm deployment.

[![CI](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml)
[![Deploy to Hostinger](https://github.com/vijayptiwari/LangStitch/actions/workflows/deploy-hostinger.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/deploy-hostinger.yml)
[![Publish Docker](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml)

| Link | URL |
|------|-----|
| **Product site (live try)** | [langstitch.com](https://langstitch.com/) |
| **Full IDE** | [langstitch.com/app/](https://langstitch.com/app/) |
| **Try page** | [langstitch.com/try.html](https://langstitch.com/try.html) |
| **Documentation** | [langstitch.com/docs/](https://langstitch.com/docs/) |

---

## Try LangStitch live

Open the **[product site](https://langstitch.com/)** — it embeds the IDE so you can try the canvas with zero install. For full screen, use **[Open IDE](https://langstitch.com/app/)**.

> Platform API features (Git, export, agent run) require Docker or local dev below.

---

## Run in 1–2 steps

### Docker (full stack)

```bash
git clone https://github.com/vijayptiwari/LangStitch.git
cd LangStitch
docker compose -f docker-compose.prod.yml up
```

Open **http://localhost:8080** — UI + Platform API.

### Local dev

```bash
git clone https://github.com/vijayptiwari/LangStitch.git && cd LangStitch
npm install && pip install -r server/requirements.txt && npm start
```

Open **http://localhost:5173**

### GitHub Codespaces

**Code → Create codespace on main** — LangStitch installs and starts automatically.

---

## Features

### Canvas nodes
- **LLM**, **Tool**, **Agent**, **Decision**, **Function**, **Subgraph**
- **RAG Agent** — bound to RAG pipelines (chunk, embed, retrieve)
- **Multi-Intent Classifier** — special decision node for intent routing
- **Alt+D** — duplicate the selected node; **right-click** a node for context-menu delete
- Undo history is capped at 50 steps with a toolbar notice when the limit is reached

### SDK Component Designer

Author your own **custom components** (nodes/connectors/adaptors) visually — no source edits required. Open **Assets → Components** to define a component manifest: identity, theme, input/output ports, a typed config-field schema, and a Python codegen template.

- Custom components appear under **Custom Components** in the palette and drag onto the canvas like built-in nodes.
- Selecting a custom node shows an **auto-generated property form** from its config-field schema.
- Components export to Python via their template (imports hoisted/deduped, secret fields emit `os.environ.get(...)` — never inlined) and are listed in `langsmith.json` under `registries.components` (`schema_version 1.2`).
- Manifests survive the project round-trip and are **portable**: export a single component as `.component.json` and import it into another project (with replace / import-as-copy collision handling).

Built-in nodes are unchanged — the component system is fully additive.

### Platform API <!-- cycle-213 -->

The FastAPI server in `server/` powers **Platform → Git, Export, Import, Build, Deploy, and Eval**. Run locally via Docker Compose (`http://localhost:8080`) or point the IDE at `http://127.0.0.1:8787` during Playwright/CI.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Version, build metadata, `node-count`, LangSmith key status |
| `POST /api/export` | ZIP bundle (Python / Spring / full) with `export-manifest.json` |
| `POST /api/eval/run` | LangSmith dataset eval against exported graph |
| `POST /api/agent/run` | Smoke-run agent from workspace |

### Platform API health

`GET /api/health` returns `node-count` (number of nodes in the active graph document) alongside version and build metadata — useful for smoke checks and monitoring.

### RAG nodes <!-- cycle-309 -->

LangStitch models retrieval-augmented generation as first-class canvas and export assets:

| Piece | Where to configure | Export path |
|-------|-------------------|-------------|
| **RAG Agent node** | Canvas palette → RAG Agent; bind a pipeline in the node designer | `nodes/` handler wired to `rag/` |
| **RAG Pipelines** | Assets → RAG Pipelines (vector, vectorless, hybrid chunk/embed/retrieve steps) | `rag/<pipeline_id>/` |
| **Query / output keys** | RAG Agent node designer — maps state keys for query input and retrieved context | Python `State` fields in generated graph |

Design a pipeline under **Assets → RAG Pipelines**, then drop a **RAG Agent** node and select that pipeline. Export includes `rag/` modules plus the agent node stub that calls `run_pipeline` at deploy time.

### Asset designers (sidebar → Assets)
| Designer | Exports to |
|----------|------------|
| Skills | `skills/` |
| Guardrails | `guardrails/` |
| Business Rules | `rules/` |
| Personas | `personas/` |
| RAG Pipelines | `rag/` (vector, vectorless, hybrid) |

### Export formats <!-- cycle-261 -->

Use **Platform → Export** (or toolbar **Save** for `.langstitch.json` only):

| Format | Value | Contents |
|--------|-------|----------|
| **Python** | `python` | **langstitch SDK** project — `@graph_node`, `GraphBuilder`, `@langstitch_graph_server`, `eval_runner.py`, Helm chart |
| **Spring Boot** | `spring` | API gateway scaffold for Java teams |
| **Full bundle** | `full` | Python + Spring + Dockerfiles + Helm chart |

All node types are **Component Designer manifests** (built-in + marketplace/custom connectors). Export also supports **diagram JPEG/PNG** from the canvas controls panel.

LangStitch remembers your last export format per project in the browser session. Re-import via **Platform → Import** (`.langstitch.json` or exported ZIP).

### Python export (langstitch SDK)
Multi-module ZIP using the **langstitch** Python SDK (`langstitch[graph,server]`). Includes `app/server.py` with `@langstitch_graph_server`, `deploy/helm/<slug>/`, and **`langsmith.json`** for IDE re-import.

```bash
pip install -e ".[dev]"
langstitch run
python -m my_langgraph.eval_runner
```

### Integrations
MCP Studio, tool/agent registry, remote graphs, A2A, LangSmith, Langfuse, structured logging, checkpointers.

### Platform panel
Git sync, export/import, versioning, Docker build, Helm deploy.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save project (`.langstitch.json`) |
| `Ctrl+E` / `Ctrl+K` / `Ctrl+L` / `Alt+H` | Toggle Platform drawer |
| `Alt+G` / `Alt+K` | Open Platform → Eval tab |
| `Ctrl+D` | Open Platform → Eval tab (when no node selected) |
| `Alt+D` | Duplicate selected canvas node |
| `Ctrl+H` | Duplicate selected canvas node |
| `Ctrl+F` | Focus graph name search |
| `Ctrl+G` / `Ctrl+M` | Toggle minimap |
| `Alt+P` | Toggle minimap |
| `Ctrl+Shift+Z` | Redo last reset |
| `?` | Open keyboard shortcuts help |

Press **?** in the IDE or use the toolbar help button for the full list.

---

## Production hosting (Hostinger)

The public sites are served from Hostinger shared hosting, split across subdomains.
A single FTP upload to `public_html/` covers every host because each subdomain's
document root is a sub-folder created in hPanel:

```
langstitch.com               → public_html/             Product landing + /app IDE + /docs
langtailor.langstitch.com    → public_html/langtailor/  Desktop IDE download page
sdk.langstitch.com           → public_html/sdk/         Python SDK landing
marketplace.langstitch.com   → public_html/marketplace/ Marketplace SPA
```

Built and deployed by [`.github/workflows/deploy-hostinger.yml`](.github/workflows/deploy-hostinger.yml)
on every push to `main`.

| Setting | Where | Value |
|---------|-------|-------|
| `FTP_SERVER` / `FTP_USERNAME` / `FTP_PASSWORD` | repo **Secrets** | Hostinger FTP credentials (hPanel → Files → FTP Accounts) |
| `FTP_PUBLIC_DIR` | repo **Variables** *(optional)* | FTP path to the web root, default `public_html/` |
| `PLATFORM_API_BASE` | repo **Variables** *(optional)* | marketplace/IDE API base, e.g. `https://api.langstitch.com/api` |

> Shared hosting is static-only: the marketplace **frontend** is served here, but its
> FastAPI backend (`server/`) must run elsewhere (VPS / container host) and be pointed
> at via `PLATFORM_API_BASE`.

---

## GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [**Deploy to Hostinger**](.github/workflows/deploy-hostinger.yml) | Push to `main` | Build all sites + FTPS upload |
| [**Publish Docker**](.github/workflows/publish-docker.yml) | Push to `main` / tags | GHCR images (API / marketplace backend) |
| [**CI**](.github/workflows/ci.yml) | Push / PR | Build, E2E, agent smoke |
| [**Release**](.github/workflows/release.yml) | Tag `v*` / manual | GitHub Release + archive |

---

## LangSmith Eval Runner <!-- cycle-165 -->

Configure dataset evals from **Platform → Eval** (requires LangSmith enabled under Graph Designer → Observability).

- **Validate config** — dry-run without API key; result panel shows **pass rate** and a **Dry-run only** badge when `LANGCHAIN_API_KEY` is unset on the platform API
- **Run eval** — requires `LANGCHAIN_API_KEY` on the platform API host
- Export includes `eval` and **`eval-dataset`** metadata in `langsmith.json`, plus `eval_runner.py` for CI

```bash
# After export
python src/<package>/eval_runner.py --dry-run
```

---

## Testing

```bash
npm install
npx playwright install chromium
npm run test:e2e
npm run agent:run
```

## Project structure

```
LangStitch/
├── site/             Public sites: landing + langtailor/ + sdk/ subdomain pages
├── docs/             Documentation site
├── src/              React IDE
├── server/           FastAPI platform API
├── docker/           Dockerfiles + nginx
├── runtime/          Runnable basic_agent.py
├── e2e/              Playwright tests
└── deploy/helm/      Kubernetes chart
```

## License

MIT
