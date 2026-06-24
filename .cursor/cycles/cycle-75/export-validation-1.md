# Export / Codegen Validation — Cycle 75

| Field | Value |
|-------|-------|
| Delivery | 1 |
| Validator | export-codegen-validator |
| Verdict | **VALIDATED** |
| Export formats tested | python, full |
| Fixture | `createDefaultDocument()` + `DEFAULT_EVAL` (e2e/cycles-batch-07.spec.ts) |
| Changed file | `src/lib/codegen/pythonProjectGenerator.ts` |

## Scope

Include `eval-dataset` metadata block in exported `langsmith.json` when eval is enabled and a dataset name or ID is configured. Conditional spread mirrors existing `bundleGenerator.generateExportManifest` gating (`hasEvalDataset`).

## Static review

| Item | Result |
|------|--------|
| `generateLangsmithJson` adds top-level `eval-dataset` when `ev.enabled && (datasetName \|\| datasetId)` | OK |
| Existing `eval` block unchanged | OK |
| `langsmith` / `langstitch` blocks unchanged | OK |
| No breaking renames | OK |
| `generatePythonProject` still assigns `files['langsmith.json'] = generateLangsmithJson(doc)` | OK |

## Checks

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| EXP-CHK-1 | langsmith.json valid JSON with version 1.0 | PASS | `version=1.0`, `langsmith.project_name` present |
| EXP-CHK-2 | eval-dataset block when eval enabled + dataset | PASS | `{"enabled":true,"dataset_name":"batch7_langsmith_ds","dataset_id":"ds-cycle75-001"}` |
| EXP-CHK-3 | eval-dataset.dataset_name matches settings | PASS | `batch7_langsmith_ds` |
| EXP-CHK-4 | eval-dataset.dataset_id matches settings | PASS | `ds-cycle75-001` |
| EXP-CHK-5 | eval block retained alongside eval-dataset | PASS | `eval.enabled=true`, same dataset fields |
| EXP-CHK-6 | langsmith.tracing_v2 present | PASS | `true` |
| EXP-CHK-7 | eval-dataset omitted when eval disabled | PASS | keys: `version, langsmith, eval, langstitch` only |
| EXP-CHK-8 | eval-dataset omitted when no dataset name/id | PASS | enabled eval, empty strings — no `eval-dataset` key |
| EXP-CHK-9 | eval-dataset with dataset_id only | PASS | `{"enabled":true,"dataset_id":"uuid-only-ds"}` |
| EXP-CHK-10 | buildExportBundle langsmith.json includes eval-dataset (python/full) | PASS | both formats |
| EXP-CHK-11 | bundle contains pyproject.toml + langsmith.json | PASS | python + full |
| EXP-CHK-12 | generatePythonProject langsmith.json matches generateLangsmithJson | PASS | byte-identical output |
| EXP-CHK-13 | py_compile on generated Python modules | PASS | `python -m compileall -q` exit 0 |
| EXP-CHK-14 | E2E cycle-75 unit test | PASS | `npx playwright test … -g "cycle-75"` — 1 passed |
| EXP-CHK-15 | npm run build | PASS | tsc + vite build exit 0 |

## Sample langsmith.json excerpt (eval configured)

```json
{
  "version": "1.0",
  "langsmith": {
    "project_name": "langstitch-graph",
    "tracing_v2": true
  },
  "eval": {
    "enabled": true,
    "dataset_name": "batch7_langsmith_ds"
  },
  "eval-dataset": {
    "enabled": true,
    "dataset_name": "batch7_langsmith_ds",
    "dataset_id": ""
  }
}
```

## Defects

None.

## Handoff

Export/codegen **VALIDATED** for Delivery 1. Proceed to **feature-automation-author**.

Validation script: `scripts/validate-cycle-75-export.mjs` (run via `npx tsx scripts/validate-cycle-75-export.mjs`).
