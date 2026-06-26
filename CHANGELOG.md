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

Example (Cycle 81):

```
- **Batch 8 (Cycles 81–90):** CHANGELOG cycle 81 template, health metadata reload E2E, toolbar redo keyboard hint, Platform Health last-sync, guardrail required validation, snap-to-grid toggle, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-08.spec.ts`).
```

Example (Cycle 91):

```
- **Batch 9 (Cycles 91–100):** Ctrl+F focus search shortcut, merge viewport on import, graphStore JSDoc, platform-git-tab E2E, disable platform on empty graph, export retry, guardrail char count, multi-select delete confirm, eval-dataset export warning, export rate-limit 429 message (`e2e/cycles-batch-09.spec.ts`).
```

### Added (Batch 3)
- **Batch 3 (Cycles 31–40):** Shortcuts modal documents Ctrl+F focus search, undo stack depth limit notice (50), CHANGELOG cycle entry template, toolbar-save visibility E2E, disable redo on empty graph, Platform export retry on error, guardrail description character count, Ctrl+D node duplicate, export eval-dataset warning, rate-limit friendly `/api/export` 429 message (`e2e/cycles-batch-03.spec.ts`).
- **Batch 4 (Cycles 41–50):** Eval dry-run badge when API key missing, high-contrast palette focus ring, Alt+G opens Eval tab, merge imported viewport on load, graphStore JSDoc, health metadata E2E after reload, toolbar platform aria-label, collapsible Platform Eval section, guardrail search filter, edge label truncation with tooltip (`e2e/cycles-batch-04.spec.ts`).
- **Batch 5 (Cycles 51–60):** Export manifest with eval-dataset, OpenAPI `/api/openapi.json` for export, eval session history (cap 53), aria-live eval finished, Ctrl+K platform toggle, dirty flag clears on import, core docs link, open-shortcuts E2E, redo last-used persistence, Platform log copy-to-clipboard (`e2e/cycles-batch-05.spec.ts`).
- **Batch 6 (Cycles 61–70):** Guardrail delete confirm, minimap selected-node highlight, export dry-run eval-dataset preview, CORS preflight `/api/export`, eval dataset link in result summary, reduce-motion CSS, shortcuts toggle minimap, viewport localStorage prefix, README RAG nodes section, toolbar-save visibility E2E (`e2e/cycles-batch-06.spec.ts`).
- **Batch 7 (Cycles 71–80):** Toolbar platform tooltip, Deploy tab loading skeleton, guardrail designer empty-state hint, canvas context menu delete node, `langsmith.json` eval-dataset metadata, health API `node-count`, eval pass-rate in result panel, shortcuts modal focus trap, Alt+D duplicate node, undo depth limit notice (`e2e/cycles-batch-07.spec.ts`).
- **Batch 8 (Cycles 81–90):** CHANGELOG cycle 81 entry template, health metadata E2E after reload, toolbar redo Ctrl+Shift+Z hint, Platform Health last-sync timestamp, guardrail required-field validation, snap-to-grid canvas toggle, Python eval-dataset comment header, API `X-Request-ID` response header, regression eval preset, skip link to main canvas (`e2e/cycles-batch-08.spec.ts`).
- **Batch 9 (Cycles 91–100):** Ctrl+F focus search shortcut with cycle-91 testid, merge imported viewport on load, graphStore JSDoc (cycle 93), platform-git-tab E2E with `platform-tab-git`, disable toolbar Platform on empty graph, export retry on API error, guardrail description character count, multi-select delete confirmation, export eval-dataset warning, rate-limit friendly `/api/export` 429 message (`e2e/cycles-batch-09.spec.ts`).
