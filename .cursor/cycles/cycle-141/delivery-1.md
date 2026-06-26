# Delivery 1 — SDK Component Designer (cycle 141)

| Field | Value |
|-------|-------|
| LLD | `.cursor/cycles/cycle-141/LLD.md` (Approved) |
| BRD | `.cursor/cycles/cycle-141/BRD.md` |
| Scope delivered | MVP tasks **LLD-T1 … LLD-T6** (T7 phase-2 NOT implemented) |
| Build | `npm run build` (tsc -b && vite build) — **PASS** |
| Lint | touched files — **0 errors**; repo lint 0 errors, 2 pre-existing warnings (untouched files) |

## Summary

- Added a **manifest-driven custom component system** that runs alongside the existing hardcoded node kinds. The only change to the `NodeKind` union is the additive value `'custom'`; every existing default node/codegen/theme path is byte-for-byte unchanged (FR-8 / NFR-1).
- A single generic renderer (`CustomComponentNode`), a generic manifest property form (`ManifestConfigForm`), a new **Components** designer tab (`ComponentDesignerPanel`), and exactly one new codegen `switch` case drive every custom component from its `ComponentManifest`.
- Codegen uses a **pure whitelist string-substitution engine** (`templateEngine.ts`) — no `eval`, `new Function`, dynamic import, or arbitrary execution; secrets emit `os.environ.get(...)`; interpolations are escaped per field kind (NFR-4).
- Portable single-component `.component.json` export/import with collision handling (replace / import-as-copy / cancel).
- `GraphDocument` bumped to `1.2` with backward-compatible defaulting; `componentRegistry` persists through save/git/import/restore via `DOCUMENT_KEYS`.

## LLD tasks completed

| Task | Status | Notes |
|------|--------|-------|
| LLD-T1 Types + store + migration | Done | `component.ts`, `NodeKind 'custom'`, `CustomNodeData`, `GraphDocument.componentRegistry`, v1.2, store CRUD + `placeCustomNode` + `countComponentInstances`, `loadProject` defaulting, `createDefaultDocument` v1.2, `DOCUMENT_KEYS` |
| LLD-T2 Dynamic renderer + palette | Done | `customComponents.ts`, `CustomComponentNode.tsx`, `nodeTypes.custom='customNode'`, `nodeTheme` custom base + `getThemeForNode`, palette "Custom Components" group + `custom:<id>` drag, `AppLayout.onDrop` |
| LLD-T3 Generic property form | Done | `ManifestConfigForm.tsx` + `NodeDesigner` `kind==='custom'` branch (all 7 field kinds, inline validation, missing-manifest notice) |
| LLD-T4 Component Designer UI | Done | `ComponentDesignerPanel.tsx`, 4th "Components" tab, identity/theme/ports/config-fields/codegen forms, live Python preview, export/delete/import |
| LLD-T5 Codegen | Done | `templateEngine.ts`, `generateNodeFunction` `case 'custom'` + threaded `componentRegistry`, import hoist/dedupe, `langsmith.json` `registries.components` + `schema_version '1.2'` |
| LLD-T6 Portability | Done | `componentIO.ts` (validate + (de)serialize + collision id helper), `.component.json` export/import, collision dialog |
| LLD-T7 (phase-2) | **Not done** (out of scope by request) | marketplace/package endpoints + defaults migration |

## Files added

| File | Purpose |
|------|---------|
| `src/types/component.ts` | `ComponentManifest`, `ConfigField`, `ComponentPort`, `ComponentTheme`, `ComponentCodegen`, `PortableComponentFile` |
| `src/lib/customComponents.ts` | `ICON_MAP`/`resolveIcon`, `customPaletteItems`, `resolveComponent`, `buildDefaultConfig` |
| `src/lib/codegen/templateEngine.ts` | Safe whitelist `renderTemplate` + `buildRenderContext` |
| `src/lib/componentIO.ts` | `validateManifest`, `serializeComponent`, `parseComponentFile`, `makeCopyId`, `slugifyId` |
| `src/components/canvas/nodes/CustomComponentNode.tsx` | Generic manifest-driven node renderer |
| `src/components/designer/ManifestConfigForm.tsx` | Auto-generated property form |
| `src/components/designer/ComponentDesignerPanel.tsx` | Component authoring UI (Components tab) |
| `eslint.config.js` | Recreated canonical flat config (was missing from tree — see deviations) |

## Files modified

| File | Change |
|------|--------|
| `src/types/graph.ts` | `NodeKind += 'custom'`; `CustomNodeData`; `StitchNodeData` union; `GraphDocument.version '1.2'` + `componentRegistry` |
| `src/store/graphStore.ts` | `designerTab` type += `'components'`; component CRUD; `countComponentInstances`; `placeCustomNode`; `loadProject` defaulting |
| `src/lib/nodeRegistry.ts` | `nodeTypes.custom = 'customNode'` |
| `src/lib/nodeTheme.ts` | `custom` base theme entry; `getThemeForNode(node, registry)` overlay |
| `src/components/canvas/nodes/BaseNode.tsx` | Optional `theme` override + `targetHandles` (additive; existing callers unchanged) |
| `src/components/canvas/GraphCanvas.tsx` | Registered `customNode: CustomComponentNode` |
| `src/components/panels/NodePalette.tsx` | "Custom Components" group + `custom:<id>` drag + click-to-place |
| `src/components/layout/AppLayout.tsx` | `onDrop` handles `custom:<id>` → `placeCustomNode` |
| `src/components/designer/DesignerPanel.tsx` | 4th "Components" tab |
| `src/components/designer/NodeDesigner.tsx` | `kind==='custom'` → `ManifestConfigForm` |
| `src/lib/codegen/pythonGenerator.ts` | `case 'custom'`; thread `componentRegistry`; `collectComponentImports` hoist/dedupe; `createDefaultDocument` v1.2 + `componentRegistry: []` |
| `src/lib/codegen/pythonProjectGenerator.ts` | `langsmith.json` `registries.components` + `schema_version '1.2'` |
| `server/main.py` | `DOCUMENT_KEYS += "componentRegistry"` |

## FR satisfaction (file references)

- **FR-1 Visual creation, no file edits** — `ComponentDesignerPanel.tsx` ("Components" tab) creates/edits manifests; `graphStore.addComponentManifest/updateComponentManifest/removeComponentManifest`. Adding a component is a pure data op (no new source files).
- **FR-2 Manifest schema** — `src/types/component.ts` (`ComponentManifest`: id/label/category/description/icon/theme/ports/configFields/codegen). All editable in `ComponentDesignerPanel.tsx`.
- **FR-3 Palette + drag/drop** — `NodePalette.tsx` "Custom Components" group (`palette-custom-<id>`); drag payload `custom:<id>`; `AppLayout.onDrop` → `placeCustomNode`; `customPaletteItems` in `customComponents.ts`.
- **FR-4 Auto property form** — `NodeDesigner.tsx` `data.kind === 'custom'` branch → `ManifestConfigForm.tsx` renders controls per `ConfigField.kind` with inline validation; config saved via `updateNodeData(id, { config })`.
- **FR-5 Python export/codegen** — `pythonGenerator.ts` `case 'custom'` renders `manifest.codegen.template` through `renderTemplate`; imports hoisted/deduped via `collectComponentImports`; graph wiring unchanged (treated as ordinary node).
- **FR-6 Round-trip** — `componentRegistry` on `GraphDocument`; `exportGraphDocument` spreads the full doc; `loadProject` defaults `componentRegistry: document.componentRegistry ?? []`; `server/main.py DOCUMENT_KEYS` persists it through save/import/git/restore.
- **FR-7 Portable JSON** — `componentIO.serializeComponent` / `parseComponentFile` (`.component.json` wrapper `langstitchComponent: '1.0'`); export/import buttons + collision dialog in `ComponentDesignerPanel.tsx`.
- **FR-8 Defaults unchanged (additive)** — only `'custom'` added to `NodeKind`; every existing `switch (data.kind)` case, `NODE_THEMES` entry, and `nodeTypes` entry is functionally untouched; closed-union exhaustiveness preserved (TS strict build green).

## New `data-testid` hooks (LLD §9)

- Tab: `designer-tab-components`
- Panel root: `component-designer`
- Actions: `component-add`, `component-import-input`, `component-export-<id>`, `component-remove-<id>`
- Fields: `component-id-<id>`, `component-label-<id>`, `component-category-<id>`, `component-template-<id>`, `component-add-port`, `component-add-field`
- Validation/preview: `component-validation-error`, `component-preview-python`
- Collision dialog: `component-collision-dialog`, `component-collision-replace`, `component-collision-copy`
- Palette: `palette-custom-group`, `palette-custom-<componentId>`
- Canvas node: `custom-node-<componentId>`, `custom-node-missing`
- Config form: `manifest-config-field-<fieldId>`, `manifest-config-missing`, `manifest-config-output-key`
- Empty state: `component-empty-hint`

## Verification run

```bash
npm run build      # tsc -b && vite build → PASS (exit 0)
npx eslint <touched files>   # 0 errors
npm run lint       # 0 errors; 2 pre-existing warnings in untouched files
```

## How to test (maps to FR / LLD §4.3 flow)

1. Open the **Components** designer tab → **New component** (FR-1). Edit label/category/ports/config fields/template; watch the live **Preview generated Python** panel (FR-2, NFR-4).
2. The component appears under **Custom Components** in the palette; drag it (or click) onto the canvas (FR-3) → renders via `CustomComponentNode` with the manifest theme/ports.
3. Select the placed node → the **Node** designer shows the auto-generated property form; edit config (FR-4).
4. Open the code panel / export Python (FR-5): the node emits its templated `def`; manifest `imports` are hoisted; `langsmith.json.registries.components` lists the id and `schema_version` is `1.2`.
5. Save/reload (or export+import) the project — manifest + node `config` persist (FR-6).
6. **Export .component.json**, then **Import** it into the same/another project → collision dialog offers Replace / Import as copy (FR-7).
7. Delete a manifest with placed instances → confirm shows the instance count; orphan nodes render as `custom-node-missing` and export a `"""Missing component"""` stub.

## Deviations from the LLD (with justification)

1. **`eslint.config.js` recreated.** The repo's `lint` script (`eslint .`) and all eslint deps exist, but the flat config file was absent from the working tree, so lint could not run at all. I recreated the canonical Vite+React+TS flat config matching the installed plugins so the lint gate is runnable and my files verify clean. If the project intentionally omits this file, it can be reverted.
2. **Live preview shows a lightweight swatch instead of a live `CustomComponentNode` render.** LLD §7.4(6) suggested rendering a read-only `CustomComponentNode` in the designer. That component renders React Flow `<Handle>`s which throw outside a `ReactFlowProvider`, so the designer shows an icon+badge+color swatch preview plus the full **Preview generated Python** panel. Functionally equivalent for authoring; avoids a runtime crash. The real node preview is available immediately by dragging onto the canvas.
3. **Per-field config preview uses default config** (per LLD §7.4(6)) — preview runs `renderTemplate` against `buildDefaultConfig(manifest)`.

## Known limitations (LLD out-of-scope / phase-2)

- No marketplace/package endpoints or defaults-migration (LLD-T7 / FR-9/FR-10).
- Minimap uses the single `custom` base color (LLD Q1 recommendation).
- Custom-node graph wiring is linear/non-router (LLD Q4); ports render visually but multi-branch routing is phase-2.
- `dependencies` are recorded in the manifest/`langsmith.json` only, not surfaced into `pyproject.toml` (LLD Q3).
- Port `multiplicity` is stored/validated but not yet visually differentiated.

## Suggested next

`code-reviewer` → `export-codegen-validator` (LLD §5 export touched) → `feature-automation-author` (write the Playwright E2E against the `data-testid` hooks above; must reach **PASSED**) → `feature-uat-hard-checker` → `release-docs-ci-steward`.
