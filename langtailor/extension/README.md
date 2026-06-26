# LangTailor Canvas

**Visual LangGraph IDE inside VS Code / VSCodium** — design agent workflows on a drag-and-drop canvas and export production-ready Python projects powered by the **langstitch** SDK.

LangTailor Canvas is the built-in graph editor for [LangTailor](https://langtailor.langstitch.com), the open-source desktop IDE for LangGraph development. Open any `*.langstitch.json` file to launch the canvas; edits sync to the document so VS Code owns save, undo, and dirty-state.

---

## Features

### Visual graph design

- **Node library** — Start, End, LLM, Tool, Agent, Router, Function, Subgraph, RAG, Intent Classifier, Human Interrupt, and Scope blocks
- **Component Designer** — all built-in nodes are manifest-driven and extensible via marketplace connectors and custom components
- **Subgraphs** — nested graphs with drill-down navigation
- **Annotations** — decorative shapes, text labels, and scope/group frames for documentation layouts
- **Beautify** — one-click Dagre auto-layout
- **Alignment tools** — left, center, right, top, middle, bottom, and distribute for selected nodes
- **Canvas lock** — freeze a finalized diagram to prevent accidental edits
- **Export diagram** — save the canvas as JPEG or PNG for docs and presentations

### Developer workflow (Command Palette)

| Command | Shortcut | Description |
|---------|----------|-------------|
| **LangTailor: New Graph** | — | Create a new `.langstitch.json` project |
| **LangTailor: Open Project** | — | Open `.langstitch.json`, exported `.zip`, or scaffold folder |
| **LangTailor: Build** | `Ctrl+Shift+B` | Scaffold full Python project + `pip install -e .` |
| **LangTailor: Run** | `F5` | Start FastAPI server via `langstitch run` |
| **LangTailor: Test** | — | Run the generated graph evaluator |
| **LangTailor: Package** | — | Build Python wheel + Helm chart for deployment |
| **LangTailor: Version** | — | Bump project semver (patch / minor / major) |
| **LangTailor: Export** | `Ctrl+Shift+E` | Export Python ZIP, Spring bundle, full bundle, or diagram image |

### SDK-first Python export

Generated projects use the **langstitch** Python SDK exclusively:

- `GraphBuilder` assembly from manifest codegen templates
- `@langstitch_graph_server` FastAPI entrypoint
- `human_interrupt` primitive for human-in-the-loop pauses
- Helm chart artifacts for Kubernetes deployment
- Eval runner for graph validation

---

## Getting started

1. Install **LangTailor Canvas** (this extension) or download the [LangTailor desktop IDE](https://langtailor.langstitch.com) with the extension preinstalled.
2. Run **LangTailor: New Graph** from the Command Palette.
3. Drag nodes from the palette, connect edges, configure nodes in the designer panel.
4. Press **Build** to scaffold the Python project, then **Run** to start the server.

### Requirements

- VS Code / VSCodium **1.90+**
- Python **3.10+** with `pip` (for Build, Run, Test, Package commands)
- `langstitch` SDK (installed automatically by the Build command)

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `langtailor.pythonPath` | `python` | Python interpreter for build/run/test/package |
| `langtailor.outputDir` | `${workspaceFolder}/build` | Where Build writes the generated project |
| `langtailor.serverPort` | `8000` | Port for `langstitch run` |
| `langtailor.imageRepository` | *(graph slug)* | Container image repo in the Helm chart |

---

## Portable downloads

LangTailor portable ZIPs for Windows and macOS ship with this extension **preinstalled** — no marketplace install step required.

---

## Links

- [LangTailor desktop IDE](https://langtailor.langstitch.com)
- [LangStitch platform](https://langstitch.com)
- [Source repository](https://github.com/vijayptiwari/LangStitch)
- [Issue tracker](https://github.com/vijayptiwari/LangStitch/issues)
- [Open VSX listing](https://open-vsx.org/extension/langstitch/langtailor-canvas)

---

## License

MIT — see [LICENSE](LICENSE).
