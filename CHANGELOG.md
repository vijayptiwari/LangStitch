# Changelog

All notable changes to LangStitch are documented here.

## [Unreleased]

### Added
- **LangSmith Eval Runner MVP** (SDLC Cycle 1): Platform drawer **Eval** tab, dataset config, dry-run validation, `POST /api/eval/run`, `eval` section in `langsmith.json`, generated `eval_runner.py`, E2E coverage (`e2e/eval-runner.spec.ts`).
- SDLC subagents and `langstitch-sdlc-cycle` skill under `.cursor/`.
- **Cycles 2–9:** Graph Designer eval summary, Ctrl+S save, health API version, export format memory, LangSmith eval link, save timestamp, shortcuts modal (`e2e/cycles-ux.spec.ts`).
- **Cycle 10:** Master SDLC pilot report (`.cursor/cycles/cycle-10/master-sdlc-report.md`).
- **Batch 1 (Cycles 11–20):** Toolbar redo tooltip, Deploy tab skeleton, Skills empty-state, snap-to-grid toggle, `langsmith.json` `generator_version`, health `build_time`, eval `latency_ms`, shortcuts focus trap, `Ctrl+E` platform toggle, viewport localStorage (`e2e/cycles-batch-01.spec.ts`).
