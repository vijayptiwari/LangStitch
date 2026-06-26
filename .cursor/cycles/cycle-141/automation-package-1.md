# Feature Automation Package — SDK Component Designer

| Field | Value |
|-------|-------|
| Feature / cycle | SDK Component Designer (custom nodes, connectors & adaptors) — cycle 141 |
| BRD / LLD refs | FR-1…FR-8, LLD §9 Testing strategy, §4.3 sequence, §5.4 codegen |
| Delivery tested | feature-implementer Delivery 1 (LLD-T1…T6; T7 phase-2 out of scope) |
| Author | feature-automation-author |
| Date | 2026-06-26 |

## Automation Verdict: PASSED

| Metric | Value |
|--------|-------|
| Feature specs | 6/6 passed (`e2e/sdk-component-designer.spec.ts`) |
| Build | `npm run build` PASS (exit 0) |
| Regression slice | `smoke.spec.ts` + `basic-agent.spec.ts` → 9/9 PASS |
| Mode | full |
| Blocking gaps | none |

---

## 1. Automation scope summary

- **In-scope FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-7, NFR-1, NFR-4 (8 / 8 MVP-testable via E2E).
- **FR-6 (round-trip persistence)** is exercised indirectly through export (`.component.json`) re-import collision; full project save/load round-trip is covered by existing server/integration tests and the import path here. No dedicated UI save→reload spec added (server reload watcher makes a hard save→reload UI step flaky; see §11).
- **Out of scope (explicit):** FR-9 / FR-10 (marketplace, packaging) — phase-2, not delivered.
- **New files:**
  - `e2e/sdk-component-designer.spec.ts` (6 tests)
  - `e2e/fixtures/weather-fetcher.component.json` (portable component fixture)
- **Modified files:** none (no product code changes; all required `data-testid` hooks already present from Delivery 1).

## 2. Traceability matrix (FR → Test)

| FR / Story | Priority | Test ID | Type | Spec file | Status |
|------------|----------|---------|------|-----------|--------|
| FR-1 Visual creation (no file edits) | P0 | AUTO-FR-1-happy | E2E | sdk-component-designer.spec.ts | PASS |
| FR-2 Manifest schema (id/label/fields/template) | P0 | AUTO-FR-1-happy | E2E | sdk-component-designer.spec.ts | PASS |
| FR-3 Palette + drag/click place | P0 | AUTO-FR-1-happy, AUTO-FR-7-import | E2E | sdk-component-designer.spec.ts | PASS |
| FR-4 Auto property form on selection | P0 | AUTO-FR-1-happy, AUTO-FR-7-import | E2E | sdk-component-designer.spec.ts | PASS |
| FR-5 Python export/codegen (templated def) | P0 | AUTO-FR-1-happy, AUTO-FR-7-import | E2E | sdk-component-designer.spec.ts | PASS |
| FR-5 / NFR-4 Safe escaping + secret → os.environ.get | P0 | AUTO-FR-7-import | E2E | sdk-component-designer.spec.ts | PASS |
| FR-7 Portable JSON import (no collision) | P0 | AUTO-FR-7-import | E2E | sdk-component-designer.spec.ts | PASS |
| FR-7 Export → re-import collision "import as copy" | P0 | AUTO-FR-7-collision | E2E | sdk-component-designer.spec.ts | PASS |
| Manifest validation (negative) | P0 | AUTO-FR-1-validation | E2E | sdk-component-designer.spec.ts | PASS |
| Orphan node after delete (error path) | P0 | AUTO-FR-4-missing | E2E | sdk-component-designer.spec.ts | PASS |
| NFR-1 No regression to defaults | P0 | AUTO-REG-defaults + smoke/basic-agent | E2E | sdk-component-designer.spec.ts, smoke.spec.ts, basic-agent.spec.ts | PASS |

## 3. Test design document

### 3.1 `e2e/sdk-component-designer.spec.ts`

**Purpose:** Prove the full author → place → configure → export lifecycle and portability against the Delivery-1 `data-testid` hooks.
**Prerequisites:** Playwright dual webServer (Vite `:5173` + API `:8787`); default demo graph (6 nodes).
**Tags:** `@p0`, `@regression`.

| Test ID | Scenario | Steps | Expected |
|---------|----------|-------|----------|
| AUTO-FR-1-happy | Author, place, configure, export | 1. Open `designer-tab-components` → `component-empty-hint` visible 2. `component-add` → `component-id-custom_component` = "custom_component" 3. Set `component-label-custom_component` = "Greeter" 4. `component-add-field` → field_1 5. Fill `component-template-custom_component` with sentinel template 6. `component-preview-python` contains `def custom_component...` + `GREETER_SENTINEL Greeter` 7. No `component-validation-error` 8. `palette-custom-group` + `palette-custom-custom_component` visible 9. Click palette item → `custom-node-custom_component` visible, node count 7 10. Click node → `designer-tab-node` active 11. Fill `manifest-config-field-field_1`="Ada", `manifest-config-output-key`="greeting" 12. `code-block` contains `GREETER_SENTINEL Greeter`, `name = "Ada"`, `"greeting"`, `def custom_…` | All assertions pass; zero `console.error` |
| AUTO-FR-1-validation | Invalid template blocked | New component → fill template `return {}` (no `def {{nodeName}}`) | `component-validation-error` visible, mentions nodeName/def |
| AUTO-FR-4-missing | Orphan after delete | New component → place node → accept confirm dialog (asserts instance count) → `component-remove-custom_component` | `palette-custom-custom_component` gone; `custom-node-missing` visible; `manifest-config-missing` shown on select |
| AUTO-FR-7-import | Import portable JSON + secret codegen | Import `weather-fetcher.component.json` → `component-id-weather_fetcher`; place; configure city="Paris", api_key="WEATHER_API_KEY", outputKey="weather" | `code-block` contains `WEATHER_SENTINEL Weather Fetcher`, `city = "Paris"`, `os.environ.get("WEATHER_API_KEY")`, `"weather"`, `import os` |
| AUTO-FR-7-collision | Export → re-import copy | New component → export (download `custom_component.component.json`) → re-import same file → `component-collision-dialog` → `component-collision-copy` | Dialog closes; 2 `component-id-*`; 3 `palette-custom-*` (group + 2 items) |
| AUTO-REG-defaults | Defaults unaffected | Fresh load asserts 6 nodes, no `palette-custom-group`, palette/canvas/designer visible; open Components tab → empty hint, still 6 nodes | NFR-1 regression guard passes |

## 4. Fixtures & test data

| File | Purpose | Key fields |
|------|---------|------------|
| `e2e/fixtures/weather-fetcher.component.json` | FR-7 import + secret codegen | id `weather_fetcher`, `connector`, configFields `city` (string,required) + `api_key` (secret), template carries `WEATHER_SENTINEL`, `imports: ["import os"]`, icon `cloud` |

## 5. Page objects / helpers

Thin inline helper `openComponentsTab(page)` in-spec (single shared step ×4). No separate page-object module warranted yet.

## 6. API automation detail

No new endpoints in MVP (LLD §6 — phase-2 only). Existing API health/run paths covered by `smoke.spec.ts` / `basic-agent.spec.ts` in the regression slice.

## 7. Export / codegen verification

| Check | Flow | Assertion |
|-------|------|-----------|
| Templated `def` emitted | place + configure custom node | `code-block` matches `def custom_…(state: State) -> dict:` |
| Sentinel/docstring rendered | author template | `GREETER_SENTINEL Greeter` / `WEATHER_SENTINEL Weather Fetcher` present |
| String escaping (NFR-4) | config string field | `name = "Ada"`, `city = "Paris"` (JSON-stringified literals) |
| Secret never inlined (NFR-4) | secret field | `os.environ.get("WEATHER_API_KEY")` present; raw value not inlined |
| Import hoist | manifest `imports` | `import os` present in code panel |
| Live preview parity | designer preview panel | `component-preview-python` renders against default config |

## 8. Regression & smoke impact

- Existing specs touched: **none**.
- New `@regression` test: `AUTO-REG-defaults`.
- Verified slice: `npm run test:e2e -- e2e/smoke.spec.ts e2e/basic-agent.spec.ts` → **9 passed**.
- Recommended order: `npm run test:e2e -- e2e/smoke.spec.ts e2e/sdk-component-designer.spec.ts`.

## 9. CI integration

| Change | File | Detail |
|--------|------|--------|
| None | — | New spec + fixture live under default `testDir: ./e2e`; picked up automatically. No `workers`/parallel changes; no new env vars. |

## 10. Execution log (evidence)

| Command | Result | Duration | Notes |
|---------|--------|----------|-------|
| `npm run build` | PASS | ~2s build | exit 0 (chunk-size warning only) |
| `npm run test:e2e -- e2e/sdk-component-designer.spec.ts` | PASS | 23.4s | 6 passed |
| `npm run test:e2e -- e2e/smoke.spec.ts e2e/basic-agent.spec.ts` | PASS | 25.1s | 9 passed |

## 11. Gaps & hooks needed in product code

| Item | Type | Owner | Status |
|------|------|-------|--------|
| All required `data-testid` hooks (`designer-tab-components`, `component-add`, `component-template-*`, `component-preview-python`, `palette-custom-*`, `custom-node-*`, `manifest-config-*`, collision dialog ids) | test hooks | feature-implementer | PRESENT (no additions needed) |
| Env note: `npm run dev:api` runs `uvicorn --reload` watching the repo; a stray file change can restart the API mid-run and flake the first test. Re-run is green. | infra | release-docs-ci-steward | OBSERVED (non-blocking; CI uses fresh servers) |

## 12. Handoff to feature-uat-hard-checker

Run for UAT evidence:
- `npm run build && npm run test:e2e -- e2e/sdk-component-designer.spec.ts`
- Regression: `npm run test:e2e -- e2e/smoke.spec.ts e2e/basic-agent.spec.ts`

UAT mapping:
- UAT-FR-1/2 → AUTO-FR-1-happy
- UAT-FR-3 → AUTO-FR-1-happy, AUTO-FR-7-import
- UAT-FR-4 → AUTO-FR-1-happy, AUTO-FR-4-missing
- UAT-FR-5 / NFR-4 → AUTO-FR-1-happy, AUTO-FR-7-import
- UAT-FR-7 → AUTO-FR-7-import, AUTO-FR-7-collision
- UAT-NFR-1 → AUTO-REG-defaults + smoke/basic-agent
