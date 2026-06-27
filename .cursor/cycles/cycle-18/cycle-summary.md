# Batch 18 — Cycles 181–190

**Status:** COMPLETE  
**E2E:** `e2e/cycles-batch-18.spec.ts` — 10/10 passed  
**UAT:** ACCEPTED (verified features + regression E2E)

## Delivered

| Cycle | Feature | Evidence |
|-------|---------|----------|
| 181 | Guardrail delete confirm | `data-cycle="181"` on remove button |
| 182 | Ctrl+D node duplicate | GraphCanvas + E2E with selection |
| 183 | Export dry-run eval-dataset | manifest preview E2E |
| 184 | CORS preflight `/api/export` | OPTIONS request E2E |
| 185 | Eval dataset link in result | `eval-result-dataset-link` data-cycle |
| 186 | Reduce-motion CSS | `prefers-reduced-motion` block comment |
| 187 | **Alt+P toggle minimap** | GraphCanvas handler + shortcuts list |
| 188 | Merge imported viewport | graphStore localStorage merge |
| 189 | graphStore JSDoc | public API doc comments |
| 190 | Health metadata after reload | platform health + API E2E |

## Notes

- Cycle 187 is the main new wiring this batch (`Alt+P` minimap); other cycles reuse established UX from batches 4–17 with dedicated regression coverage.
