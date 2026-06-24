# SDLC Batch Continuation Prompt

When this file is referenced by the loop or next orchestrator invocation:

1. Read `.cursor/cycles/batch-state.json`
2. Read themes from `.cursor/cycles/cycle-themes.json` for `nextCycleStart`–`nextCycleEnd`
3. Run **sdlc-orchestrator** for that batch with:
   - Compact mode (auto-approve BRD/LLD)
   - Auto-push after each cycle or batch commit
   - UAT ≥85, full develop loop gates
4. On batch complete:
   - Update `batch-state.json` (increment batch, advance cycle pointers)
   - Append batch row to `master-sdlc-report-2500.md`
   - Commit + push
   - If `completedCycles < 2500`, start next batch immediately (no user pause)

## Current state

See `batch-state.json` for live pointers.

## Scale note

2500 cycles = 250 batches × 10 cycles. Each batch is one orchestrator invocation.
Estimated: ~1–2 hours per batch with full gates → multi-week program if run continuously.
