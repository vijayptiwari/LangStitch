# LangStitch

**LangStitch** is a visual, drag-and-drop IDE for building [LangGraph](https://langchain-ai.github.io/langgraph/) workflows — with git sync, multi-format export, Docker builds, and Kubernetes/Helm deployment.

[![CI](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/vijayptiwari/LangStitch/actions/workflows/pages.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/pages.yml)
[![Publish Docker](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml/badge.svg)](https://github.com/vijayptiwari/LangStitch/actions/workflows/publish-docker.yml)

**Documentation:** [vijayptiwari.github.io/LangStitch/docs/](https://vijayptiwari.github.io/LangStitch/docs/)  
**Live app (hosted):** [vijayptiwari.github.io/LangStitch/](https://vijayptiwari.github.io/LangStitch/)

---

## Run in 1–2 steps

### 1 step — use hosted (canvas only)

Open **[https://vijayptiwari.github.io/LangStitch/](https://vijayptiwari.github.io/LangStitch/)** — no install.  
*(Platform API features need Docker or local dev below.)*

### 2 steps — full stack with Docker

```bash
git clone https://github.com/vijayptiwari/LangStitch.git
cd LangStitch
docker compose -f docker-compose.prod.yml up
```

Open **http://localhost:8080** — UI + Platform API (Git, export, agent run, etc.)

> Images are published automatically to `ghcr.io/vijayptiwari/langstitch-web` and `langstitch-api` on every push to `main`.

### 2 steps — local dev (no Docker)

```bash
git clone https://github.com/vijayptiwari/LangStitch.git && cd LangStitch
npm install && pip install -r server/requirements.txt && npm start
```

Open **http://localhost:5173**

### 1 click — GitHub Codespaces

Click **Code → Create codespace on main**. LangStitch installs and starts automatically.

---

## GitHub Actions (automated publish)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [**Deploy GitHub Pages**](.github/workflows/pages.yml) | Push to `main` | Publishes app + docs to GitHub Pages |
| [**Publish Docker**](.github/workflows/publish-docker.yml) | Push to `main` / tags | Pushes `langstitch-web` + `langstitch-api` to GHCR |
| [**CI**](.github/workflows/ci.yml) | Push / PR | Build, E2E tests, agent smoke test |
| [**Release**](.github/workflows/release.yml) | Tag `v*` / manual | GitHub Release with source archive |

---

## Features

- **Visual canvas** — color-coded nodes (LLM, Agent, Tool, Decision, Subgraph, etc.)
- **Integrations** — MCP Studio, tool/agent registry, A2A, LangSmith, Langfuse
- **Live Python export** — `StateGraph` code generation
- **Platform panel** — Git, export/import, versioning, build, deploy
- **Helm chart** — deploy to Kubernetes

## Platform capabilities

| Tab | What it does |
|-----|----------------|
| **Git** | Init/connect remote, pull (resync), commit & push |
| **Export** | ZIP: Python, Spring, or full bundle (+ Docker + Helm) |
| **Import** | `.langstitch.json` or exported ZIP |
| **Versions** | Local snapshots with restore |
| **Build** | `docker build` for Python and/or Spring |
| **Deploy** | `helm upgrade --install` |

Workspaces: `~/.langstitch/workspaces/<project-id>/`

## Run the basic agent

```bash
npm run agent:run

# With API running
curl -X POST http://127.0.0.1:8787/api/agent/run \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":\"basic_agent_test\"}"
```

## E2E tests

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

## Project structure

```
LangStitch/
├── src/              React UI
├── server/           FastAPI platform API
├── docker/           Dockerfiles + nginx
├── runtime/          Runnable basic_agent.py
├── e2e/              Playwright tests
├── docs/             Documentation site (GitHub Pages)
└── deploy/helm/      Kubernetes chart
```

## License

MIT
