# LangStitch

**LangStitch** is a visual, drag-and-drop IDE for building [LangGraph](https://langchain-ai.github.io/langgraph/) workflows — with asset designers, RAG pipelines, Python 3.13 multi-module export, git sync, Docker, and Kubernetes/Helm deployment.

[![CI](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/vijayptiwari/LangStitch/actions/workflows/pages.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/pages.yml)
[![Publish Docker](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml)

| Link | URL |
|------|-----|
| **Product site (live try)** | [vijayptiwari.github.io/LangStitch/](https://vijayptiwari.github.io/LangStitch/) |
| **Full IDE** | [vijayptiwari.github.io/LangStitch/app/](https://vijayptiwari.github.io/LangStitch/app/) |
| **Try page** | [vijayptiwari.github.io/LangStitch/try.html](https://vijayptiwari.github.io/LangStitch/try.html) |
| **Documentation** | [vijayptiwari.github.io/LangStitch/docs/](https://vijayptiwari.github.io/LangStitch/docs/) |

---

## Try LangStitch live

Open the **[product site](https://vijayptiwari.github.io/LangStitch/)** — it embeds the IDE so you can try the canvas with zero install. For full screen, use **[Open IDE](https://vijayptiwari.github.io/LangStitch/app/)**.

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

### Asset designers (sidebar → Assets)
| Designer | Exports to |
|----------|------------|
| Skills | `skills/` |
| Guardrails | `guardrails/` |
| Business Rules | `rules/` |
| Personas | `personas/` |
| RAG Pipelines | `rag/` (vector, vectorless, hybrid) |

### Python 3.13 export
Multi-module ZIP with `graphs/`, `nodes/`, `skills/`, `prompts/`, `tools/`, `guardrails/`, `rag/`, etc. Includes **`langsmith.json`** for IDE re-import.

```bash
pip install -e ".[dev]"
pytest
python -m my_langgraph
```

### Integrations
MCP Studio, tool/agent registry, remote graphs, A2A, LangSmith, Langfuse, structured logging, checkpointers.

### Platform panel
Git sync, export/import, versioning, Docker build, Helm deploy.

---

## GitHub Pages site structure

```
/LangStitch/           ← Product landing (live try iframe)
/LangStitch/app/       ← Full LangStitch IDE (React)
/LangStitch/try.html   ← Full-screen try page
/LangStitch/docs/      ← Documentation
```

Built by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`.

---

## GitHub Actions

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [**Deploy GitHub Pages**](.github/workflows/pages.yml) | Push to `main` | Product site + IDE + docs |
| [**Publish Docker**](.github/workflows/publish-docker.yml) | Push to `main` / tags | GHCR images |
| [**CI**](.github/workflows/ci.yml) | Push / PR | Build, E2E, agent smoke |
| [**Release**](.github/workflows/release.yml) | Tag `v*` / manual | GitHub Release + archive |

---

## LangSmith Eval Runner

Configure dataset evals from **Platform → Eval** (requires LangSmith enabled under Graph Designer → Observability).

- **Validate config** — dry-run without API key
- **Run eval** — requires `LANGCHAIN_API_KEY` on the platform API host
- Export includes `eval` in `langsmith.json` and `eval_runner.py` for CI

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
├── site/             Product website (GitHub Pages landing)
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
