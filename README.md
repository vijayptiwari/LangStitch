# LangStitch

**LangStitch** is a visual, drag-and-drop IDE for building [LangGraph](https://langchain-ai.github.io/langgraph/) workflows — with git sync, multi-format export, Docker builds, and Kubernetes/Helm deployment.

**Documentation (hosted):** [https://vijayptiwari.github.io/LangStitch/docs/](https://vijayptiwari.github.io/LangStitch/docs/)  
**Live app (static):** [https://vijayptiwari.github.io/LangStitch/](https://vijayptiwari.github.io/LangStitch/)

## Features

- **Visual canvas** — color-coded nodes (LLM, Decision, Tool, Subgraph Connector, etc.)
- **Live Python export** — `StateGraph` code generation
- **Platform panel** — Git, export/import, versioning, build, deploy
- **Spring Boot gateway** — Java API that proxies to the Python LangGraph runtime
- **Helm chart** — deploy Python + Spring to any Kubernetes cluster

## Quick start

```bash
npm install
pip install -r server/requirements.txt

# Terminal 1 — platform API (git, export, deploy)
npm run dev:api

# Terminal 2 — UI
npm run dev
```

Open http://localhost:5173 → click **Platform** in the toolbar.

## Platform capabilities

| Tab | What it does |
|-----|----------------|
| **Git** | Init/connect remote, pull (resync), commit & push full project |
| **Export** | ZIP: Python, Spring, or full bundle (+ Docker + Helm) |
| **Import** | `.langstitch.json` or exported ZIP back into canvas |
| **Versions** | Local snapshots with restore |
| **Build** | `docker build` for Python and/or Spring images |
| **Deploy** | `helm upgrade --install` to your cluster |

Workspaces are stored at `~/.langstitch/workspaces/<project-id>/`.

## Export formats

- **Python** — LangGraph graph + FastAPI `/invoke` runtime + Dockerfile
- **Spring** — Spring Boot 3 gateway (`/api/v1/graph/invoke`) forwarding to Python service
- **Full** — both runtimes, `docker-compose.yml`, and `deploy/helm/langstitch/`

## Deploy with Helm

```bash
# After export or Platform → Deploy
helm upgrade --install my-graph deploy/helm/langstitch \
  --namespace langstitch --create-namespace \
  --set python.image.tag=latest \
  --set spring.image.tag=latest
```

## Run the basic agent

```bash
# Standalone smoke-test agent (no LangGraph deps required)
npm run agent:run

# Via platform API (starts after dev:api)
curl -X POST http://127.0.0.1:8787/api/agent/run -H "Content-Type: application/json" -d "{\"project_id\":\"basic_agent_test\"}"
```

## E2E tests (Playwright)

Playwright starts the API + Vite dev server automatically and mimics a user building a basic agent in the UI.

```bash
npm install
npx playwright install chromium
npm run test:e2e          # headless — 9 tests
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:report   # open HTML report
```

Tests cover: IDE smoke, adding Agent nodes, tool registry, loading `e2e/fixtures/basic-agent.langstitch.json`, and running the agent via `/api/agent/run`.

## Project structure

```
langstitch/
├── src/                  # React UI
├── server/               # FastAPI platform API
├── runtime/              # Runnable basic_agent.py for smoke tests
├── e2e/                  # Playwright tests + fixtures
├── deploy/helm/langstitch/  # Kubernetes Helm chart
```

## License

MIT
