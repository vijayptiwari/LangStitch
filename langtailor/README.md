# LangTailor

**LangTailor** is the downloadable desktop LangGraph IDE — a custom **Electron** app with two switchable views (canvas + Monaco code editor), bidirectional graph↔code sync, and full IDE features (terminal, git SCM, LSP, debugger, plugins).

Targets: **Windows x64**, **macOS x64/arm64**, **Linux x64**.

The canvas reuses LangStitch React code (`/src`). The **langtailor-canvas** VSIX extension remains available for VS Code / VSCodium users.

## Architecture

```
LangTailor (Electron IDE)
├── renderer — shared /src React app (canvas + code views + IDE shell)
├── main — file I/O, build/run, git, LSP/debug sidecars, auto-update
├── preload — acquireVsCodeApi() shim + langtailor.* APIs
└── plugins/ — native marketplace component host
```

## Dual-view sync

- **Canvas view** — drag-and-drop LangGraph designer
- **Code view** — Monaco editor with generated Python modules
- **Bidirectional sync** — add/remove nodes updates files; edit custom regions updates the graph model
- **Deletion guard** — confirms before removing nodes with custom code

## Develop locally

```bash
# Web IDE (Vite)
npm install
npm start
# http://localhost:5173

# Electron desktop
npm run build:desktop
cd langtailor/desktop
npm install
npm run build:main
npm start
```

## Build installers

```bash
npm run build:desktop
cd langtailor/desktop
npm install
npm run dist        # all platforms on current OS
npm run dist:win    # Windows NSIS + portable
npm run dist:mac    # macOS dmg
```

GitHub Release on `langtailor-v*` tags builds VSIX + Electron artifacts via [langtailor-release.yml](../.github/workflows/langtailor-release.yml).

## VS Code extension (optional)

```bash
npm run build:webview
cd langtailor/extension && npm install && npm run build
# F5 — LangTailor Canvas Extension
```

## Testing

```bash
npm run test:unit
pytest runtime/tests/test_parse_graph.py
npm run test:e2e          # web IDE specs
# After building desktop:
LANGTAILOR_ELECTRON_E2E=1 npx playwright test -c playwright.desktop.config.ts
```

Manual sign-off: [docs/testing/UAT_CHECKLIST.md](../docs/testing/UAT_CHECKLIST.md)

## Downloads

[langtailor.langstitch.com](https://langtailor.langstitch.com) · [GitHub Releases](https://github.com/LangStitch/langtailor/releases)
