# Changelog

All notable changes to LangStitch are documented here.

## [Unreleased]

### Added
- **Batch 66 (Cycles 661–670):** guardrail delete confirm, snap-to-grid toggle, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Ctrl+Shift+D minimap shortcut, merge viewport on import, graphStore JSDoc, save-and-reload E2E (`e2e/cycles-batch-66.spec.ts`).
- **Batch 65 (Cycles 651–660):** export manifest eval-dataset, OpenAPI export docs, eval history limit 653, eval live region, Alt+Shift+K platform toggle, undo depth notice, CHANGELOG cycle 657 template, health reload E2E, redo persistence, Git copy (`e2e/cycles-batch-65.spec.ts`).
- **Batch 64 (Cycles 641–650):** eval dry-run badge, palette focus ring, Ctrl+Shift+E eval tab, viewport localStorage, README eval runner, toolbar-save E2E, platform aria-label, eval section collapse, guardrail search, context delete (`e2e/cycles-batch-64.spec.ts`).
- **Batch 63 (Cycles 631–640):** Ctrl+Shift+G focus search, dirty-clears-on-import, docs tooltip, platform git tab E2E, empty-graph redo guard, export retry, guardrail char count, minimap highlight, eval-dataset warning, export rate-limit 429 (`e2e/cycles-batch-63.spec.ts`).
- **Batch 62 (Cycles 621–630):** graphStore JSDoc, health reload E2E, platform Ctrl+E hint, health last-sync, guardrail validation, edge truncation, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-62.spec.ts`).
- **Batch 61 (Cycles 611–620):** toolbar redo tooltip, deploy skeleton, guardrail empty-state, Ctrl+D duplicate, langsmith eval-dataset, health node-count, eval pass-rate, modal focus trap, Alt+Shift+H duplicate shortcut, merge viewport on import (`e2e/cycles-batch-61.spec.ts`).
- **Batch 60 (Cycles 601–610):** guardrail delete confirm, multi-select delete confirm, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, undo depth notice, CHANGELOG cycle 609 template, toolbar-save E2E (`e2e/cycles-batch-60.spec.ts`).
- **Batch 59 (Cycles 591–600):** export manifest eval-dataset, OpenAPI export docs, eval history limit 593, eval live region, Ctrl+E platform toggle, viewport localStorage, README keyboard shortcuts, open-shortcuts E2E, platform tab persist, Git copy (`e2e/cycles-batch-59.spec.ts`).
- **Batch 58 (Cycles 581–590):** eval dry-run badge, palette focus ring, Alt+Shift+D eval tab shortcut, dirty-clears-on-import, docs help tooltip, health reload E2E, toolbar redo aria-label, eval section collapse, guardrail search, snap-to-grid toggle (`e2e/cycles-batch-58.spec.ts`).
- **Batch 57 (Cycles 571–580):** shortcuts focus search, merge viewport on import, graphStore JSDoc, toolbar-save E2E, empty-graph platform guard, export retry, guardrail char count, context delete, eval-dataset warning, export rate-limit 429 (`e2e/cycles-batch-57.spec.ts`).
- **LangStitch SDK tracing & LangSmith graph registration**: `langstitch.tracing` module — `configure_tracing`, `register_graph`, `traced_invoke`, `trace_node`, structured JSON logging (`LOG_FORMAT=json`), correlation IDs, and `langstitch register` CLI. `LangStitchApp.build_graph()` registers the entrypoint with LangSmith when configured; `runtime/basic_agent.py` runs via the SDK with local graph registration fallback.
- **Batch 14 (Cycles 141–150):** graphStore JSDoc, toolbar-save E2E, platform Ctrl+E hint, health last-sync, guardrail validation, canvas delete context menu, eval-dataset Python header, API `X-Request-ID`, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-14.spec.ts`).
- **Cycle 151:** `Alt+L` focuses node palette search with filter input (`e2e/cycles-batch-15.spec.ts`).
- **Batch 15 (Cycles 151–160):** palette search shortcut, dirty-clears-on-import, docs link tooltip, health reload E2E, empty-graph redo guard, export retry, guardrail char count, snap-to-grid toggle, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-15.spec.ts`).
- **Batch 16 (Cycles 161–170):** eval dry-run badge marker, high-contrast palette focus ring, `Ctrl+D` opens Eval tab, viewport localStorage, README eval runner docs, export-zip download E2E, platform aria-label, eval section collapse, guardrail search filter, multi-select delete confirm (`e2e/cycles-batch-16.spec.ts`).
- **Batch 17 (Cycles 171–180):** export manifest eval-dataset, OpenAPI export docs, eval history limit 173, eval live region, shortcuts toggle platform, undo depth notice, CHANGELOG template, toolbar-save E2E, redo persistence, Git copy (`e2e/cycles-batch-17.spec.ts`).
- **Batch 18 (Cycles 181–190):** guardrail delete confirm, Ctrl+D duplicate, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Alt+P minimap, merge viewport on import, graphStore JSDoc, health reload E2E (`e2e/cycles-batch-18.spec.ts`).
- **Batch 19 (Cycles 191–200):** platform tooltip, deploy skeleton, guardrail empty-state, edge label truncation, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, Ctrl+H duplicate, dirty-clears-on-import (`e2e/cycles-batch-19.spec.ts`).
- **Batch 20 (Cycles 201–210):** docs help tooltip, eval dry-run flow, redo keyboard hint, health last-sync, guardrail validation, minimap highlight, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-20.spec.ts`).
- **Batch 21 (Cycles 211–220):** shortcuts focus search, viewport localStorage, README platform API, toolbar-save E2E, empty-graph platform guard, export retry, guardrail char count, context delete, eval-dataset warning, export rate-limit 429 (`e2e/cycles-batch-21.spec.ts`).
- **Batch 22 (Cycles 221–230):** eval dry-run badge, palette focus ring, Alt+K eval tab, undo depth notice, CHANGELOG template, health reload E2E, redo aria-label, eval section collapse, guardrail search, snap-to-grid toggle (`e2e/cycles-batch-22.spec.ts`).
- **Batch 23 (Cycles 231–240):** export manifest eval-dataset, OpenAPI export docs, eval history limit 233, eval live region, Ctrl+L platform toggle, merge viewport on import, graphStore JSDoc, open-shortcuts E2E, platform tab persist, Git copy (`e2e/cycles-batch-23.spec.ts`).
- **Batch 24 (Cycles 241–250):** guardrail delete confirm, multi-select delete confirm, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, dirty-clears-on-import, docs help tooltip, toolbar-save E2E (`e2e/cycles-batch-24.spec.ts`).
- **Batch 25 (Cycles 251–260):** toolbar redo tooltip, deploy skeleton, guardrail empty-state, Ctrl+D duplicate, langsmith eval-dataset, health node-count, eval pass-rate, modal focus trap, Alt+E duplicate, viewport localStorage (`e2e/cycles-batch-25.spec.ts`).
- **Batch 26 (Cycles 261–270):** README export formats, health reload E2E, platform keyboard hint, health last-sync, guardrail validation, edge label truncation, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-26.spec.ts`).
- **Batch 27 (Cycles 271–280):** Ctrl+P focus search, undo depth notice, CHANGELOG cycle 273 template, platform-git-tab E2E, empty-graph redo guard, export retry, guardrail char count, minimap highlight, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-27.spec.ts`).
- **Batch 28 (Cycles 281–290):** eval dry-run badge, palette focus ring, shortcuts open eval tab, merge viewport on import, graphStore JSDoc, toolbar-save E2E, platform aria-label, eval section collapse, guardrail search, context menu delete (`e2e/cycles-batch-28.spec.ts`).
- **Batch 29 (Cycles 291–300):** export manifest eval-dataset, OpenAPI export docs, eval history limit 293, eval live region, Alt+G platform toggle, dirty-clears-on-import, docs help tooltip, health reload E2E, redo persistence, Git copy (`e2e/cycles-batch-29.spec.ts`).
- **Batch 30 (Cycles 301–310):** guardrail delete confirm, snap-to-grid toggle, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Ctrl+K minimap, viewport localStorage, README RAG nodes, save-and-reload E2E (`e2e/cycles-batch-30.spec.ts`).
- **Batch 31 (Cycles 311–320):** platform tooltip, deploy skeleton, guardrail empty-state, multi-select delete confirm, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, shortcuts duplicate node docs, undo depth notice (`e2e/cycles-batch-31.spec.ts`).
- **Batch 32 (Cycles 321–330):** CHANGELOG cycle 321 template, toolbar-save E2E, toolbar redo keyboard hint, Platform Health last-sync, guardrail required validation, Ctrl+D node duplicate, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-32.spec.ts`).
- **Batch 33 (Cycles 331–340):** Alt+D palette search, merge viewport on import, graphStore JSDoc, health reload E2E, disable platform on empty graph, export retry, guardrail char count, edge label truncation, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-33.spec.ts`).
- **Batch 34 (Cycles 341–350):** eval dry-run badge, palette focus ring, Ctrl+E open eval tab, dirty-clears-on-import, docs help tooltip, export-zip E2E, redo aria-label, eval section collapse, guardrail search filter, minimap highlight (`e2e/cycles-batch-34.spec.ts`).
- **Batch 35 (Cycles 351–360):** export manifest eval-dataset, OpenAPI export docs, eval history limit 353, eval live region, shortcuts toggle platform, viewport localStorage, README keyboard shortcuts, toolbar-save E2E, platform tab persist, Git copy (`e2e/cycles-batch-35.spec.ts`).
- **Batch 36 (Cycles 361–370):** guardrail delete confirm, context menu delete, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Alt+Shift+H minimap, undo depth notice, CHANGELOG cycle 369 template, health reload E2E (`e2e/cycles-batch-36.spec.ts`).
- **Batch 37 (Cycles 371–380):** toolbar redo tooltip, deploy skeleton, guardrail empty-state, snap-to-grid toggle, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, Ctrl+G duplicate node, merge viewport on import (`e2e/cycles-batch-37.spec.ts`).
- **Batch 38 (Cycles 381–390):** graphStore JSDoc, eval dry-run E2E flow, platform keyboard hint, health last-sync, guardrail validation, multi-select delete confirm, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-38.spec.ts`).
- **Batch 39 (Cycles 391–400):** shortcuts focus search docs, dirty-clears-on-import, docs help tooltip, toolbar-save E2E, empty-graph redo guard, export retry, guardrail char count, Ctrl+D duplicate, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-39.spec.ts`).
- **Batch 40 (Cycles 401–410):** eval dry-run badge, palette focus ring, Alt+Shift+L eval tab, viewport localStorage, README eval runner, health reload E2E, platform aria-label, eval section collapse, guardrail search, edge label truncation (`e2e/cycles-batch-40.spec.ts`).
- **Batch 41 (Cycles 411–420):** export manifest eval-dataset, OpenAPI export docs, eval history limit 413, eval live region, Ctrl+D platform toggle docs, undo depth notice, CHANGELOG cycle 417 template, open-shortcuts E2E, redo persistence, Git copy (`e2e/cycles-batch-41.spec.ts`).
- **Batch 42 (Cycles 421–430):** guardrail delete confirm, minimap highlight, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, merge viewport on import, graphStore JSDoc, toolbar-save E2E (`e2e/cycles-batch-42.spec.ts`).
- **Batch 43 (Cycles 431–440):** platform tooltip, deploy skeleton, guardrail empty-state, context menu delete, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, Alt+Shift+P duplicate node, dirty-clears-on-import (`e2e/cycles-batch-43.spec.ts`).
- **Batch 44 (Cycles 441–450):** docs help tooltip, health reload E2E, toolbar redo keyboard hint, health last-sync, guardrail validation, snap-to-grid toggle, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-44.spec.ts`).
- **Batch 45 (Cycles 451–460):** shortcuts focus search docs, viewport localStorage, README platform API, platform git tab E2E, empty-graph platform guard, export retry, guardrail char count, multi-select delete confirm, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-45.spec.ts`).
- **Batch 46 (Cycles 461–470):** eval dry-run badge, palette focus ring, shortcuts open eval tab, undo depth notice, CHANGELOG cycle 465 template, toolbar-save E2E, redo aria-label, eval section collapse, guardrail search, Ctrl+D duplicate node (`e2e/cycles-batch-46.spec.ts`).
- **Batch 47 (Cycles 471–480):** export manifest eval-dataset, OpenAPI export docs, eval history limit 473, eval live region, Alt+K platform toggle docs, merge viewport on import, graphStore JSDoc, health reload E2E, platform tab persist, Git copy (`e2e/cycles-batch-47.spec.ts`).
- **Batch 48 (Cycles 481–490):** guardrail delete confirm, edge label truncation, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, dirty-clears-on-import, docs help tooltip, save-and-reload E2E (`e2e/cycles-batch-48.spec.ts`).
- **Batch 49 (Cycles 491–500):** toolbar redo tooltip, deploy skeleton, guardrail empty-state, minimap highlight, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, shortcuts duplicate node docs, viewport localStorage (`e2e/cycles-batch-49.spec.ts`).
- **Batch 50 (Cycles 501–510):** README export formats, toolbar-save E2E, platform keyboard hint, health last-sync, guardrail validation, context menu delete, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-50.spec.ts`).
- **Batch 51 (Cycles 511–520):** Alt+E focus search, undo depth notice, CHANGELOG cycle 513 template, health reload E2E, empty-graph redo guard, export retry, guardrail char count, snap-to-grid toggle, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-51.spec.ts`).
- **Batch 52 (Cycles 521–530):** eval dry-run badge, palette focus ring, Ctrl+Shift+P eval tab, merge viewport on import, graphStore JSDoc, export-zip E2E, platform aria-label, eval section collapse, guardrail search, multi-select delete confirm (`e2e/cycles-batch-52.spec.ts`).
- **Batch 53 (Cycles 531–540):** export manifest eval-dataset, OpenAPI export docs, eval history limit 533, eval live region, shortcuts toggle platform, dirty-clears-on-import, docs help tooltip, toolbar-save E2E, redo persistence, Git copy (`e2e/cycles-batch-53.spec.ts`).
- **Batch 54 (Cycles 541–550):** guardrail delete confirm, Ctrl+D duplicate node, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, viewport localStorage, README RAG nodes, health reload E2E (`e2e/cycles-batch-54.spec.ts`).
- **Batch 55 (Cycles 551–560):** platform tooltip, deploy skeleton, guardrail empty-state, edge label truncation, langsmith eval-dataset metadata, health node-count, eval pass-rate, modal focus trap, shortcuts duplicate node docs, undo depth notice (`e2e/cycles-batch-55.spec.ts`).
- **Batch 56 (Cycles 561–570):** CHANGELOG cycle 561 template, eval dry-run E2E, toolbar redo keyboard hint, health last-sync, guardrail validation, minimap highlight, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-56.spec.ts`).
- **SDK Component Designer** (SDLC Cycle 141): a manifest-driven **Components** designer tab for visually authoring custom nodes/connectors/adaptors — define identity, theme, ports, a typed config-field schema, and a safe Python codegen template with no manual file edits. Custom components appear under **Custom Components** in the palette, drag onto the canvas, and render an auto-generated property form on selection. Components participate in Python export/codegen via their template (imports hoisted/deduped, secrets emit `os.environ.get(...)`), are listed in `langsmith.json` `registries.components` (`schema_version 1.2`), survive the project round-trip, and are portable via single-component `.component.json` export/import with collision handling (replace / import-as-copy). Built-in default nodes are unchanged (additive `'custom'` kind). UAT **ACCEPTED 96/100**; E2E `e2e/sdk-component-designer.spec.ts` (6/6).
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

Example (Cycle 369):

```
- **Batch 36 (Cycles 361–370):** guardrail delete confirm, context menu delete, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Alt+Shift+H minimap, undo depth notice, CHANGELOG cycle 369 template, health reload E2E (`e2e/cycles-batch-36.spec.ts`).
```

Example (Cycle 657):

```
- **Batch 65 (Cycles 651–660):** export manifest eval-dataset, OpenAPI export docs, eval history limit 653, eval live region, Alt+Shift+K platform toggle, undo depth notice, CHANGELOG cycle 657 template, health reload E2E, redo persistence, Git copy (`e2e/cycles-batch-65.spec.ts`).
```

Example (Cycle 609):

```
- **Batch 60 (Cycles 601–610):** guardrail delete confirm, multi-select delete confirm, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, shortcuts minimap docs, undo depth notice, CHANGELOG cycle 609 template, toolbar-save E2E (`e2e/cycles-batch-60.spec.ts`).
```

Example (Cycle 561):

```
- **Batch 56 (Cycles 561–570):** CHANGELOG cycle 561 template, eval dry-run E2E, toolbar redo keyboard hint, health last-sync, guardrail validation, minimap highlight, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-56.spec.ts`).
```

Example (Cycle 513):

```
- **Batch 51 (Cycles 511–520):** Alt+E focus search, undo depth notice, CHANGELOG cycle 513 template, health reload E2E, empty-graph redo guard, export retry, guardrail char count, snap-to-grid toggle, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-51.spec.ts`).
```

Example (Cycle 465):

```
- **Batch 46 (Cycles 461–470):** eval dry-run badge, palette focus ring, shortcuts open eval tab, undo depth notice, CHANGELOG cycle 465 template, toolbar-save E2E, redo aria-label, eval section collapse, guardrail search, Ctrl+D duplicate node (`e2e/cycles-batch-46.spec.ts`).
```

Example (Cycle 417):

```
- **Batch 41 (Cycles 411–420):** export manifest eval-dataset, OpenAPI export docs, eval history limit 413, eval live region, Ctrl+D platform toggle docs, undo depth notice, CHANGELOG cycle 417 template, open-shortcuts E2E, redo persistence, Git copy (`e2e/cycles-batch-41.spec.ts`).
```

Example (Cycle 321):

```
- **Batch 32 (Cycles 321–330):** CHANGELOG cycle 321 template, toolbar-save E2E, toolbar redo keyboard hint, Platform Health last-sync, guardrail required validation, Ctrl+D node duplicate, Python eval-dataset header, API X-Request-ID, regression eval preset, skip-to-canvas link (`e2e/cycles-batch-32.spec.ts`).
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

Example (Cycle 101):

```
- **Batch 10 (Cycles 101–110):** eval dry-run badge, palette focus ring, shortcuts open eval tab (cycle-103 testid), dirty flag clears on import, help docs link, toolbar-save E2E, toolbar redo aria-label, collapsible Eval section, guardrail search filter, Ctrl+D node duplicate (`e2e/cycles-batch-10.spec.ts`).
```

Example (Cycle 129):

```
- **Batch 12 (Cycles 121–130):** guardrail delete confirm, edge label truncation tooltip, export dry-run eval-dataset, CORS preflight /api/export, eval dataset link in summary, reduce-motion CSS, Ctrl+G toggle minimap, undo depth notice, CHANGELOG cycle 129 template, save-and-reload E2E (`e2e/cycles-batch-12.spec.ts`).
```

Example (Cycle 309):

```
- **Batch 30 (Cycles 301–310):** guardrail delete confirm, snap-to-grid toggle, export dry-run eval-dataset, CORS preflight export, eval dataset link, reduce-motion CSS, Ctrl+K minimap, viewport localStorage, README RAG nodes, save-and-reload E2E (`e2e/cycles-batch-30.spec.ts`).
```

Example (Cycle 297):

```
- **Batch 29 (Cycles 291–300):** export manifest eval-dataset, OpenAPI export docs, eval history limit 293, eval live region, Alt+G platform toggle, dirty-clears-on-import, docs help tooltip, health reload E2E, redo persistence, Git copy (`e2e/cycles-batch-29.spec.ts`).
```

Example (Cycle 285):

```
- **Batch 28 (Cycles 281–290):** eval dry-run badge, palette focus ring, shortcuts open eval tab, merge viewport on import, graphStore JSDoc, toolbar-save E2E, platform aria-label, eval section collapse, guardrail search, context menu delete (`e2e/cycles-batch-28.spec.ts`).
```

Example (Cycle 273):

```
- **Batch 27 (Cycles 271–280):** Ctrl+P focus search, undo depth notice, CHANGELOG cycle 273 template, platform-git-tab E2E, empty-graph redo guard, export retry, guardrail char count, minimap highlight, eval-dataset export warning, export rate-limit 429 (`e2e/cycles-batch-27.spec.ts`).
```

Example (Cycle 225):

```
- **Batch 22 (Cycles 221–230):** eval dry-run badge, palette focus ring, Alt+K open eval tab, undo depth notice, CHANGELOG cycle 225 template, health reload E2E, toolbar redo aria-label, eval section collapse, guardrail search filter, snap-to-grid toggle (`e2e/cycles-batch-22.spec.ts`).
```

Example (Cycle 189):

```
- **Batch 18 (Cycles 181–190):** guardrail delete confirm, Ctrl+D duplicate, export dry-run eval-dataset, CORS preflight /api/export, eval dataset link in summary, reduce-motion CSS, Alt+P toggle minimap, merge viewport on import, graphStore JSDoc, health reload E2E (`e2e/cycles-batch-18.spec.ts`).
```

Example (Cycle 177):

```
- **Batch 17 (Cycles 171–180):** export manifest eval-dataset, OpenAPI /api/export description, eval history limit 173, eval finished live region, shortcuts toggle platform, undo depth notice, CHANGELOG cycle 177 template, toolbar-save E2E, redo last-used persistence, Git output copy (`e2e/cycles-batch-17.spec.ts`).
```

Example (Cycle 141):

```
- **Batch 14 (Cycles 141–150):** graphStore JSDoc (cycle 141), toolbar-save visibility E2E, Platform Ctrl+E hint (cycle 143), Platform Health last-sync (cycle 144), guardrail required validation (cycle 145), canvas context menu delete (cycle 146), Python eval-dataset comment header (cycle 147), API X-Request-ID (cycle 148), regression eval preset (cycle 149), skip-to-canvas link (cycle 150) (`e2e/cycles-batch-14.spec.ts`).
```

### Added (Batch 3)
- **Batch 3 (Cycles 31–40):** Shortcuts modal documents Ctrl+F focus search, undo stack depth limit notice (50), CHANGELOG cycle entry template, toolbar-save visibility E2E, disable redo on empty graph, Platform export retry on error, guardrail description character count, Ctrl+D node duplicate, export eval-dataset warning, rate-limit friendly `/api/export` 429 message (`e2e/cycles-batch-03.spec.ts`).
- **Batch 4 (Cycles 41–50):** Eval dry-run badge when API key missing, high-contrast palette focus ring, Alt+G opens Eval tab, merge imported viewport on load, graphStore JSDoc, health metadata E2E after reload, toolbar platform aria-label, collapsible Platform Eval section, guardrail search filter, edge label truncation with tooltip (`e2e/cycles-batch-04.spec.ts`).
- **Batch 5 (Cycles 51–60):** Export manifest with eval-dataset, OpenAPI `/api/openapi.json` for export, eval session history (cap 53), aria-live eval finished, Ctrl+K platform toggle, dirty flag clears on import, core docs link, open-shortcuts E2E, redo last-used persistence, Platform log copy-to-clipboard (`e2e/cycles-batch-05.spec.ts`).
- **Batch 6 (Cycles 61–70):** Guardrail delete confirm, minimap selected-node highlight, export dry-run eval-dataset preview, CORS preflight `/api/export`, eval dataset link in result summary, reduce-motion CSS, shortcuts toggle minimap, viewport localStorage prefix, README RAG nodes section, toolbar-save visibility E2E (`e2e/cycles-batch-06.spec.ts`).
- **Batch 7 (Cycles 71–80):** Toolbar platform tooltip, Deploy tab loading skeleton, guardrail designer empty-state hint, canvas context menu delete node, `langsmith.json` eval-dataset metadata, health API `node-count`, eval pass-rate in result panel, shortcuts modal focus trap, Alt+D duplicate node, undo depth limit notice (`e2e/cycles-batch-07.spec.ts`).
- **Batch 8 (Cycles 81–90):** CHANGELOG cycle 81 entry template, health metadata E2E after reload, toolbar redo Ctrl+Shift+Z hint, Platform Health last-sync timestamp, guardrail required-field validation, snap-to-grid canvas toggle, Python eval-dataset comment header, API `X-Request-ID` response header, regression eval preset, skip link to main canvas (`e2e/cycles-batch-08.spec.ts`).
- **Batch 9 (Cycles 91–100):** Ctrl+F focus search shortcut with cycle-91 testid, merge imported viewport on load, graphStore JSDoc (cycle 93), platform-git-tab E2E with `platform-tab-git`, disable toolbar Platform on empty graph, export retry on API error, guardrail description character count, multi-select delete confirmation, export eval-dataset warning, rate-limit friendly `/api/export` 429 message (`e2e/cycles-batch-09.spec.ts`).
- **Batch 10 (Cycles 101–110):** Eval dry-run badge, palette focus ring, shortcuts open eval tab (cycle-103 testid), dirty flag clears on import, help docs link, toolbar-save E2E, toolbar redo aria-label, collapsible Eval section, guardrail search filter, Ctrl+D node duplicate (`e2e/cycles-batch-10.spec.ts`).
- **Batch 11 (Cycles 111–120):** Export manifest eval-dataset, OpenAPI `/api/export` docs, eval session history (cap 113), aria-live eval finished, Alt+H platform toggle, viewport localStorage, README keyboard shortcuts, health metadata reload E2E, platform tab last-used persistence, Platform Git log copy (`e2e/cycles-batch-11.spec.ts`).
- **Batch 12 (Cycles 121–130):** Guardrail delete confirm, edge label truncation tooltip (cycle 122), export dry-run eval-dataset preview, CORS preflight `/api/export`, eval dataset link in result summary, reduce-motion CSS, Ctrl+G toggle minimap, undo depth limit notice (cycle 128 testid), CHANGELOG cycle 129 template, save-and-reload E2E (`e2e/cycles-batch-12.spec.ts`).
- **Batch 13 (Cycles 131–140):** Toolbar redo cycle 131 tooltip, Deploy tab loading skeleton (cycle 132), guardrail empty-state hint (cycle 133), minimap selected-node highlight (cycle 134), `langsmith.json` eval-dataset metadata, health API `node-count`, eval pass-rate in result panel, shortcuts modal focus trap (cycle 138), duplicate node shortcut docs (cycle 139), merge imported viewport on load (`e2e/cycles-batch-13.spec.ts`).
- **Batch 14 (Cycles 141–150):** graphStore JSDoc (cycle 141), toolbar-save visibility E2E, Platform Ctrl+E hint (cycle 143), Platform Health last-sync (cycle 144), guardrail required validation (cycle 145), canvas context menu delete (cycle 146), Python eval-dataset comment header (cycle 147), API `X-Request-ID` (cycle 148), regression eval preset (cycle 149), skip-to-canvas link (cycle 150) (`e2e/cycles-batch-14.spec.ts`).
