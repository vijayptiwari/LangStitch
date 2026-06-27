# Batch 16 — Cycles 161–170

**Status:** COMPLETE  
**E2E:** `e2e/cycles-batch-16.spec.ts` — 10/10 passed  
**UAT:** ACCEPTED (verified features + regression E2E)

## Delivered

| Cycle | Feature | Evidence |
|-------|---------|----------|
| 161 | Eval dry-run badge when API key missing | `cycle-161-eval-dry-run` testid, E2E |
| 162 | High-contrast focus ring on node palette | 3px outline in `index.css`, E2E |
| 163 | `Ctrl+D` opens Eval tab (no node selected) | `AppLayout.tsx` handler + shortcuts list |
| 164 | Viewport persists in localStorage | `viewportStorage.ts` + E2E |
| 165 | README eval runner section | `README.md` LangSmith Eval Runner |
| 166 | E2E export-zip user flow | Download ZIP + platform log |
| 167 | Toolbar platform aria-label | `data-cycle="167"` on toolbar button |
| 168 | Collapse/expand Platform Eval section | `eval-section-toggle` data-cycle |
| 169 | Guardrail search/filter | `guardrail-search` data-cycle |
| 170 | Multi-select delete confirmation | `GraphCanvas` onBeforeDelete confirm |

## Notes

- `Ctrl+D` duplicates when a node is selected (`GraphCanvas`); opens Eval when canvas has no selection (`AppLayout`).
- Most UX existed from earlier batches; batch 16 adds cycle markers, shortcut wiring, CSS polish, and dedicated E2E coverage.
