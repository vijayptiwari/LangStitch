# BRD Cycle 141 — SDK Component Designer

- **Feature:** SDK Component Designer (community-extensible custom nodes, connectors & adaptors)
- **Category:** platform / extensibility
- **Status:** approved (requirements captured directly from user)

## Problem / opportunity

Today LangStitch's node system is closed. `NodeKind` is a hardcoded TypeScript union
(`src/types/graph.ts`) and adding a node requires editing ~7 files plus a `switch (data.kind)`
in `src/lib/codegen/pythonGenerator.ts`. Community developers cannot add their own nodes,
connectors, or adaptors. We want an **SDK Component Designer**: a first-class, in-IDE visual
tool that lets developers across the community define reusable custom components — and the
same designer should eventually also describe our built-in/default components.

## Vision

One unified, manifest-driven component model. A "component" is a declarative spec
(identity, ports, config-field schema, visual theme, codegen template). Both community
components and (eventually) our defaults are expressed the same way, authored/configured
through the same visual designer.

## Decisions locked with user

| Decision | Choice |
|----------|--------|
| Primary authoring surface | **Visual in-IDE designer** — define ports, config-field schema, theme, and a Python codegen template via forms (no code required to register a node). |
| Convergence of defaults | **Additive-first** — build the custom-component registry without disturbing the hardcoded default nodes; migrate defaults onto manifests in a later phase. |
| Distribution | **All methods eventually** (portable manifest files, installable PyPI/npm packages, hosted marketplace via Platform API). **Start with portable manifest files (JSON)** importable into a project / drop-in folder. |
| Process | **LLD-first** — produce a detailed low-level design, get user approval, then implement. |

## Functional requirements

- **FR-1** Developers can create a custom component via a visual designer (no manual file edits to register it).
- **FR-2** A component manifest declares: id, label, category, description, icon, theme; input/output ports (handles); a config-field schema (typed fields rendered as a property form); and a Python codegen template.
- **FR-3** Custom components appear in the Node Palette and can be dragged onto the canvas alongside built-in nodes.
- **FR-4** Selecting a custom-component node shows an auto-generated property form (from its config-field schema) in the Node Designer.
- **FR-5** Custom-component nodes participate in Python export/codegen via their template (graph wiring + generated node function), without breaking existing exports.
- **FR-6** Custom components and their instances survive the project round-trip (`langstitch.project.json`) and reload correctly.
- **FR-7** Components are portable: export a component as a JSON manifest and import it into another project (MVP distribution path).
- **FR-8** The built-in default node kinds remain fully functional and unchanged (additive, no regression).
- **FR-9 (phase-2)** "Connectors" and "adaptors" as specialized component categories (e.g. external service connectors, data adaptors) reuse the same manifest model.
- **FR-10 (phase-2)** Package + marketplace distribution (PyPI/npm bundle, hosted registry, install via Platform API).

## Non-functional requirements

- **NFR-1** No regression to existing canvas, designers, codegen, or Playwright suite.
- **NFR-2** TypeScript strict; React 19; Zustand; minimal diff, extend existing patterns.
- **NFR-3** Export remains the contract — custom components must survive Python export + Git.
- **NFR-4** Safe codegen templating — no arbitrary code execution in the IDE; template rendering must guard against injection/path traversal.
- **NFR-5** GraphDocument versioned migration so older projects still load.

## Out of scope (MVP)

- Full hosted marketplace and package installation flows (phase-2, FR-10).
- Migrating built-in nodes onto manifests (phase-2 of the additive plan).
- Authoring custom React renderers with arbitrary JS (MVP uses a generic manifest-driven renderer + theme).
