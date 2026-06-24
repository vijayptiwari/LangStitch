# Delivery 1 — LangSmith Eval Runner MVP

### Summary
- Added `EvalConfig` on graph settings with persistence via `graphStore`
- New **Eval** tab in Platform drawer (form + validate + run)
- `POST /api/eval/run` with dry-run and LangSmith SDK integration
- Export: `eval` block in `langsmith.json` + `eval_runner.py` in Python ZIP

### LLD tasks completed
| Task | Status | Notes |
|------|--------|-------|
| LLD-T1 Types + defaults | Done | `graph.ts`, `designerConstants.ts` |
| LLD-T2 graphStore | Done | `eval` merge in `updateGraphSettings` |
| LLD-T3 Platform Eval tab | Done | `PlatformDrawer.tsx` + testids |
| LLD-T4 platformClient | Done | `runEval` |
| LLD-T5 server route | Done | `eval_service.py`, `main.py` |
| LLD-T6 Codegen | Done | `pythonProjectGenerator.ts` |
| LLD-T7 GraphDesigner summary | Skipped | MVP platform-only |
| LLD-T8 E2E + docs | Pending | next: feature-automation-author |

### Changes
| File | Change |
|------|--------|
| `src/types/graph.ts` | `EvalConfig`, `GraphSettings.eval` |
| `src/lib/designerConstants.ts` | `DEFAULT_EVAL`, merge |
| `src/store/graphStore.ts` | eval settings merge |
| `src/components/platform/PlatformDrawer.tsx` | Eval tab UI |
| `src/lib/api/platformClient.ts` | `runEval` |
| `src/lib/codegen/pythonProjectGenerator.ts` | langsmith eval + eval_runner.py |
| `server/eval_service.py` | new |
| `server/main.py` | `/api/eval/run` |
| `server/requirements.txt` | langsmith |

### Verification run
```bash
npm run build   # PASS
```

### FR / AC checklist
- [ ] FR-1 Eval tab — implemented (needs E2E proof)
- [ ] FR-2 Persist config — implemented
- [ ] FR-3 Run eval — implemented (requires LANGCHAIN_API_KEY for live run)
- [ ] FR-4 langsmith.json eval — implemented
- [ ] FR-5 eval_runner.py — implemented
- [ ] FR-6 Disabled state — implemented
- [ ] FR-7 Error messages — implemented

### Known limitations
- Live eval requires LangSmith API key on platform API host
- Evaluators configured in LangSmith UI only (by design)
- Compare page / README not updated yet (release steward)

### Request
Route to **code-reviewer** → **export-codegen-validator** → **feature-automation-author** → **feature-uat-hard-checker**.
