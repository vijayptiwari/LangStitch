# Export / Codegen Validation — SDK Component Designer (cycle 141) — Re-run

| Field | Value |
|-------|-------|
| Delivery | 1 (redelivery after EXP-001 fix) |
| Validator | export-codegen-validator (re-run via harness) |
| **Verdict** | **VALIDATED** |
| Fix applied | `templateEngine.ts` — `jsonToPyLiteral()` maps JSON `true`/`false`/`null` → `True`/`False`/`None`; `label`/`description` escaped for docstrings |
| Harness | `scripts/validate-export-cycle141.mts` — exit 0 |

## EXP-001 resolution

`jb_1` now emits valid Python:

```python
def jb_1(state: State) -> dict:
    cfg = {"flag": True, "off": False, "none": None}
    return {"cfg": cfg}
```

All EXP-CHK-1..12 pass. EXP-002 (advisory) partially addressed via `escapePythonStrContent` for `label`/`description`.
