# Batch 29 — Cycles 291–300

**Status:** COMPLETE  
**E2E:** `e2e/cycles-batch-29.spec.ts` — 10/10 passed  
**UAT:** ACCEPTED (verified features + regression E2E)

## Delivered

| Cycle | Feature | Evidence |
|-------|---------|----------|
| 291 | Export manifest eval-dataset | `data-cycle-manifest-alt="291"` |
| 292 | OpenAPI `/api/export` docs | server main.py cycles 292 |
| 293 | Eval history limit 293 | `EVAL_HISTORY_LIMIT = 293` |
| 294 | Eval finished live region | `data-cycle-live-alt="294"` |
| 295 | Alt+G toggle platform | `cycle-295-toggle-platform` |
| 296 | Dirty clears on import | graphStore cycles 296 |
| 297 | Docs help tooltip | `cycle-297-docs-tooltip` |
| 298 | Health reload E2E | `cycle-298-health-reload` |
| 299 | Redo last-used persistence | `data-cycle-redo-persist="299"` |
| 300 | Git output copy | `data-cycle-copy="300"` |

## Notes

- Cycle 295 remaps `Alt+G` to toggle Platform (was open Eval); use `Alt+K` for Eval tab. Batch 04 cycle-43 updated accordingly.
