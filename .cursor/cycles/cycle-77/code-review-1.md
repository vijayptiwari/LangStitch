# Code Review — Eval pass-rate in result panel (Cycle 77)

| Field | Value |
|-------|-------|
| Delivery | feature-implementer Delivery 1 |
| Reviewer | code-reviewer |
| Verdict | **CHANGES REQUIRED** |
| Files reviewed | 3 |

## Summary

UI correctly renders `eval-result-pass-rate` from API `pass_rate`. Client typing updated in `platformClient.ts`. **Server always returns `pass_rate: 100.0` on successful non-dry-run eval**, regardless of LangSmith `evaluate()` results — misrepresents real pass rate to users.

## LLD alignment

- [x] Matches §3.1 approach (surface pass rate in eval panel)
- [ ] Scope within LLD-T tasks — display contract incomplete for live eval
- Issues: stub pass rate on production eval path

## Findings

| ID | Severity | File:line | Issue | Suggested fix |
|----|----------|-----------|-------|---------------|
| CR-077-001 | **Major** | server/eval_service.py:91 | `pass_rate` hardcoded to `100.0` after live `evaluate()` | Derive pass rate from LangSmith experiment results (or omit field until computable); dry-run may return `null` or omit |
| CR-077-002 | Minor | server/eval_service.py:55 | Dry-run also returns `100.0` pass rate | Omit `pass_rate` on dry-run or label UI as N/A for validation-only runs |

## Security checklist

- [x] No secrets in diff
- [x] Platform paths validated (N/A)
- [x] No unsafe HTML injection

## Testability

- `data-testid="eval-result-pass-rate"` present

## Handoff

**CHANGES REQUIRED** → feature-implementer: resolve **CR-077-001** (and optionally CR-077-002) before automation/UAT
