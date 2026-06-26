# Code Review — SDK Component Designer (cycle 141)

| Field | Value |
|-------|-------|
| Delivery | feature-implementer Delivery 1 (LLD-T1..T6) |
| Reviewer | code-reviewer |
| Verdict | **APPROVED** (0 Critical; 1 Major waived by review policy "block on Critical only") |
| Files reviewed | 20 (8 new + 12 modified) — cycle-141 scope only |
| Diff source | uncommitted working tree |

## Summary

The MVP is a clean, **additive** manifest-driven custom-component system that matches the LLD §3.1 "one `custom` kind + manifest registry" approach. Defaults are untouched, templating is safe (pure regex substitution, no `eval`/`new Function`), migration/round-trip and collision handling are correct, and orphan/missing-manifest paths are handled at render, config, and codegen layers. cycle-141 files **type-check clean** (`tsc -p tsconfig.app.json` exit 0) and **lint clean** (eslint exit 0). One Major correctness gap (unescaped top-level template tokens) should be fixed and will be re-verified by export-codegen-validator. The working tree also contains an unrelated in-flight marketplace/auth feature that currently breaks the whole-repo build — see CR-SCOPE-001.

## LLD alignment

- [x] Matches §3.1 chosen approach (one closed-union `'custom'` value + `componentId` + `config`; manifest registry on `GraphDocument`)
- [x] Scope within LLD-T1..T6 tasks (T7 correctly deferred)
- [x] Definition of Done (§14) — see checklist below
- Issues: top-level token escaping not fully specified in §5.4 and not implemented (CR-001); live-edit designer has no hard-error save gate that §7.4/§8 implies (CR-002, minor).

### DoD (§14) verification

| DoD item | Status | Evidence |
|----------|--------|----------|
| FR-1..FR-8 traceable | PASS | Delivery FR map confirmed against code |
| `'custom'` added; defaults unchanged | PASS | `NodeKind`, `NODE_THEMES`, `nodeTypes`, all `switch` cases byte-for-byte intact; `getNodeTheme` unchanged |
| `componentRegistry` persists save/sync/import/restore | PASS | `server/main.py` `DOCUMENT_KEYS += "componentRegistry"` |
| Export round-trip | PASS (shallow) | `exportGraphDocument` spreads `...doc`; `loadProject` defaults registry; deep export → export-codegen-validator |
| `langsmith.json.registries.components` + schema_version 1.2 | PASS | `pythonProjectGenerator.ts` |
| Safe templating (no eval; escaping; secrets; `# UNRESOLVED`) | PASS (with CR-001 caveat on top-level tokens) | `templateEngine.ts` |
| Portable `.component.json` + collision handling | PASS | `componentIO.ts` + `ComponentDesignerPanel` dialog |
| `data-testid` hooks present | PASS | All §9 hooks found |
| Old v1.0/v1.1 load without error | PASS | `loadProject` `componentRegistry ?? []`; version union widened |

## Findings

| ID | Severity | File:line | Issue | Suggested fix |
|----|----------|-----------|-------|---------------|
| CR-001 | Major | `src/lib/codegen/templateEngine.ts:109-116` | Top-level tokens `{{label}}` `{{description}}` `{{outputKey}}` (`{{nodeName}}` is slugified/safe) are substituted **raw/unescaped**. The default template places them in a docstring (`"""{{description}}"""`) and a dict-key string (`{"{{outputKey}}": None}`). `outputKey` is free-text user input (`manifest-config-output-key`); `label`/`description` are editable in the Node Designer. A value containing `"""`, a double-quote, a newline, or a trailing backslash yields **syntactically invalid generated Python**, weakening NFR-3 (export is the contract). `{{field.*}}` values are escaped per kind, but these are not. | Escape `description`/`label` for docstring/string context (neutralize `"""`, backslashes, newlines) and emit `outputKey` as a JSON-safe Python string literal (or validate as a slug). Add unit cases. Re-verify in export-codegen-validator. |
| CR-002 | Minor | `src/components/designer/ComponentDesignerPanel.tsx:94-119` | Designer edits write to the registry **live with no validity gate**; a manifest with hard errors (e.g., template missing `def {{nodeName}}`) still appears in the palette and is placeable. LLD §7.4/§8 implies "block save on hard errors." Errors are surfaced inline (`component-validation-error`) but non-blocking. Import path **is** gated by `parseComponentFile`. | Acceptable for MVP. Optionally exclude invalid manifests from `customPaletteItems` or disable placement while `validateManifest` has errors. |
| CR-003 | Minor | `src/lib/codegen/templateEngine.ts:46-55` | `json` field re-emits JSON text; JSON `true`/`false`/`null` are not valid Python (`True`/`False`/`None`). Acknowledged in LLD §5.4 as matching existing `inputMapping` behavior. | Flag for export-codegen-validator; consider Python-literal conversion (`json.loads`-style or token replace) in a follow-up. |
| CR-004 | Minor | `src/types/component.ts:60`, `templateEngine.ts` | `ComponentCodegen.async` is stored/edited (checkbox) but **unused** by `renderTemplate`/`buildRenderContext`; async-ness depends entirely on the template containing `async def`. | Either wire the flag (prepend `async `) or label the checkbox as advisory/documentation-only. |
| CR-005 | Suggestion | `src/components/canvas/nodes/CustomComponentNode.tsx:48` | Synthetic node object built only to reuse `getThemeForNode`. | Extract a `manifestTheme(manifest)` helper for clarity. Non-blocking. |
| CR-SCOPE-001 | Major (environment, **not** a cycle-141 code defect) | working tree | The tree mixes cycle-141 with an unrelated in-flight **marketplace/auth** feature (`server/auth.py`, `config.py`, `models.py`, `marketplace.py`, `notifications.py`, `src/components/marketplace/*`, `authClient.ts`, `authStore.ts`, `Toolbar.tsx`, plus `MarketplacePortal`/marketplace-router wiring interleaved in `AppLayout.tsx` and `server/main.py`). `npm run build` (`tsc -b`) currently **fails**: `src/components/marketplace/PublishForm.tsx(39,23): error TS18048`. cycle-141 alone is green. | Isolate the cycle-141 commit (exclude marketplace/auth files) so the build gate is green before automation/UAT. The delivery's "build PASS" claim no longer holds for the combined tree. |

## Security checklist

- [x] No secrets in diff — secret fields store env var **names**; codegen emits `os.environ.get(<name>)`, never literals
- [x] Platform paths validated — manifests are JSON inside `GraphDocument`; no manifest-derived filesystem path reaches the server; import is client-side parse; cycle-141 server change is whitelist-only (`DOCUMENT_KEYS += componentRegistry`)
- [x] No unsafe HTML injection — no `dangerouslySetInnerHTML`; no dynamic icon/component resolution (`ICON_MAP` whitelist → `box` fallback)
- [x] No code execution in IDE (NFR-4) — pure regex substitution; no `eval`/`new Function`/dynamic import; `.raw` restricted to `code` fields
- Note: the auth-middleware/marketplace changes in `server/main.py` are **out of scope** (different cycle) and were not security-reviewed here.

## Correctness highlights (PASS)

- **Additive union**: only `'custom'` added; `BaseNodeShell` changes are backward-compatible (optional `targetHandles`/`theme`; default handle still renders via `!targetHandles?.length`).
- **Graph wiring**: custom nodes flow through `add_node` + the non-router linear-edge path (`generateGraphBuilder` skips only start/end; routers unaffected).
- **Round-trip/migration**: `version` union widened to `'1.2'`; `createDefaultDocument` and `loadProject` both default `componentRegistry`; `exportGraphDocument` spreads the full doc.
- **Orphan handling**: missing manifest → `custom-node-missing` shell, `manifest-config-missing` notice + delete button, and codegen `"""Missing component"""` stub returning `{}`; delete confirm shows `countComponentInstances`.
- **Hooks order**: `CustomComponentNode` calls all hooks before the `data.kind !== 'custom'` early return — Rules of Hooks respected.

## Testability

- Missing `data-testid`: **none** — all LLD §9 hooks present (`designer-tab-components`, `component-designer`, `component-add`/`-import-input`/`-export-<id>`/`-remove-<id>`, `component-id/-label/-category/-template-<id>`, `component-add-port`/`-add-field`, `component-validation-error`, `component-preview-python`, `component-collision-dialog`/`-replace`/`-copy`, `palette-custom-group`/`palette-custom-<id>`, `custom-node-<id>`/`custom-node-missing`, `manifest-config-field-<id>`/`-missing`/`-output-key`, `component-empty-hint`).

## Verification run

```
tsc --noEmit -p tsconfig.app.json        # exit 0 (cycle-141 + app clean)
eslint <13 cycle-141 files>              # exit 0
npm run build (tsc -b && vite build)     # FAIL — PublishForm.tsx (marketplace, out of scope) — see CR-SCOPE-001
```

## Handoff

- **APPROVED** → **export-codegen-validator** (LLD §5 / codegen touched). Carry **CR-001** (top-level token escaping) and **CR-003** (json→Python literal) for deep export verification; export-codegen-validator may upgrade CR-001 if it produces invalid bundles for realistic inputs.
- **feature-implementer**: address **CR-001** (Major) before UAT; **CR-002/CR-004** at discretion; resolve **CR-SCOPE-001** by isolating the cycle-141 commit so the build gate is green.
- Then → **feature-automation-author** (E2E against the hooks above) → **feature-uat-hard-checker**.
