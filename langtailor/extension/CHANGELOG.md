# Changelog

All notable changes to **LangTailor Canvas** are documented here.

## [0.2.0] — 2026-06-27

### Added

- **Developer commands** — Build, Run, Test, Package, Version, Export, Open Project, and New Graph
- **SDK-only Python export** — generated projects use `langstitch` SDK (`GraphBuilder`, `@langstitch_graph_server`, `human_interrupt`)
- **Component Designer foundation** — 12 built-in manifest-driven node types (start, end, llm, tool, agent, router, function, subgraph, rag, intent_classifier, human_interrupt, scope)
- **Human Interrupt node** — first-class HITL pause/resume via `langstitch.human_interrupt`
- **Scope / group blocks** — container nodes with input/output transitions compiling to nested subgraphs
- **Canvas annotations** — decorative shapes, text labels, and group frames (non-codegen)
- **Beautify** — Dagre auto-layout with fit-to-view
- **Alignment tools** — left, center, right, top, middle, bottom, distribute
- **Canvas lock** — prevent accidental edits on finalized diagrams
- **Image export** — JPEG/PNG diagram export for documentation
- **Helm chart generation** — deployment artifacts in Package command output
- **Preinstalled extension** — portable VSCodium bundles unpack the VSIX into `resources/app/extensions/`

### Changed

- Build command scaffolds the full project, reconciles files, and runs `pip install -e .`
- Export supports Python ZIP, Spring bundle, full bundle, and diagram images
- Open Project accepts `.langstitch.json`, `.zip`, and exported folders
- Extension settings: `pythonPath`, `outputDir`, `serverPort`, `imageRepository`
- Keybindings: Build (`Ctrl+Shift+B`), Run (`F5`), Export (`Ctrl+Shift+E`)

### Fixed

- Blank canvas on IDE load caused by unstable Zustand selector for annotations (infinite React update loop)
- Playwright e2e config now forces `VITE_APP_MODE=ide` for reliable test runs

## [0.1.2] — prior release

- Initial LangTailor Canvas custom editor for `*.langstitch.json`
- Visual graph canvas with node palette and Python codegen preview
