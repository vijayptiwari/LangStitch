# Batch 23 — Cycles 231–240

**Status:** COMPLETE  
**E2E:** `e2e/cycles-batch-23.spec.ts` — 11/11 passed  
**UAT:** ACCEPTED (verified features + regression E2E)

## Delivered

| Cycle | Feature | Evidence |
|-------|---------|----------|
| 231 | Export manifest eval-dataset | `data-cycle-manifest="231"` |
| 232 | OpenAPI `/api/export` description | `/api/openapi.json` E2E |
| 233 | Eval history limit 233 | `EVAL_HISTORY_LIMIT = 233` |
| 234 | Eval finished live region | `data-cycle-live="234"` |
| 235 | **Ctrl+L toggle Platform** | `AppLayout.tsx` + shortcuts list |
| 236 | Merge imported viewport | graphStore localStorage merge |
| 237 | graphStore JSDoc | cycle 237 in store header |
| 238 | Open-shortcuts user flow | `shortcuts-modal` data-cycle 238 |
| 239 | Platform tab persistence | `langstitch-platform-tab-last-used` |
| 240 | Git output copy-to-clipboard | `git-output-copy` data-cycle 240 |

## Notes

- `Ctrl+L` toggles Platform (distinct from `Alt+L` palette search in NodePalette).
