# Changelog

All notable changes to LangStitch are documented here.

## [Unreleased]

### Added
- **LangSmith Eval Runner MVP** (SDLC Cycle 1): Platform drawer **Eval** tab, dataset config, dry-run validation, `POST /api/eval/run`, `eval` section in `langsmith.json`, generated `eval_runner.py`, E2E coverage (`e2e/eval-runner.spec.ts`).
- SDLC subagents and `langstitch-sdlc-cycle` skill under `.cursor/`.
- **Cycles 2–9:** Graph Designer eval summary, Ctrl+S save, health API version, export format memory, LangSmith eval link, save timestamp, shortcuts modal (`e2e/cycles-ux.spec.ts`).
- **Cycle 10:** Master SDLC pilot report (`.cursor/cycles/cycle-10/master-sdlc-report.md`).
- **Batch 1 (Cycles 11–20):** Toolbar redo tooltip, Deploy tab skeleton, Skills empty-state, snap-to-grid toggle, `langsmith.json` `generator_version`, health `build_time`, eval `latency_ms`, shortcuts focus trap, `Ctrl+E` platform toggle, viewport localStorage (`e2e/cycles-batch-01.spec.ts`).
- **Batch 2 (Cycles 21–30):** README export formats, eval dry-run E2E, Platform `Ctrl+E` hint, Platform Health last-sync, Guardrail validation, multi-select delete confirm, Python eval-dataset header, API `X-Request-ID`, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-02.spec.ts`).

## Cycle entry template

Use this block when documenting each SDLC batch in CHANGELOG:

```
- **Batch N (Cycles X–Y):** <comma-separated feature summaries> (`e2e/cycles-batch-NN.spec.ts`).
```

Example (Cycle 33):

```
- **Batch 3 (Cycles 31–40):** shortcuts focus search, undo depth notice, CHANGELOG template, toolbar-save E2E, empty-graph redo guard, export retry, guardrail char count, Ctrl+D duplicate, eval-dataset export warning, export rate-limit message (`e2e/cycles-batch-03.spec.ts`).
```

### Added (Batch 3)
- **Batch 3 (Cycles 31–40):** Shortcuts modal documents Ctrl+F focus search, undo stack depth limit notice (50), CHANGELOG cycle entry template, toolbar-save visibility E2E, disable redo on empty graph, Platform export retry on error, guardrail description character count, Ctrl+D node duplicate, export eval-dataset warning, rate-limit friendly `/api/export` 429 message (`e2e/cycles-batch-03.spec.ts`).
- **Batch 4 (Cycles 41–50):** Eval dry-run badge when API key missing, high-contrast palette focus ring, Alt+G opens Eval tab, merge imported viewport on load, graphStore JSDoc, health metadata E2E after reload, toolbar platform aria-label, collapsible Platform Eval section, guardrail search filter, edge label truncation with tooltip (`e2e/cycles-batch-04.spec.ts`).
