# Export / Codegen Validation — SDK Component Designer (cycle 141)

| Field | Value |
|-------|-------|
| Delivery | 1 |
| Validator | export-codegen-validator |
| **Verdict** | **FAILED** — 1 P0 defect (EXP-001), 1 advisory (EXP-002) |
| Export formats tested | `full` (python + spring + docker) |
| Fixture | inline `custom_components_demo` (3 manifests, 4 custom nodes incl. 1 missing-manifest + 1 async) |
| Harness | `scripts/validate-export-cycle141.mts` (run via `npx tsx`) |
| Toolchain | node v24.16.0, Python 3.14.5 |

---

## Scope

LLD §5.4 (export/codegen) and §5 are in scope: `pythonGenerator.ts` `case 'custom'`, `templateEngine.ts`, `pythonProjectGenerator.ts` `langsmith.json registries.components` + `schema_version 1.2`, `componentRegistry` round-trip, portable `.component.json`. Export validation **applies** (not N/A).

The harness exercised every advertised `ConfigField` kind (`string`, `number`, `boolean`, `select`, `code`, `secret`, `json`), the `.raw` re-indent path, import hoist/dedupe, an `async def` component, and a missing-manifest node.

---

## Checks

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| EXP-CHK-1 | ZIP/bundle contains `pyproject.toml` | PASS | present in `full` file list |
| EXP-CHK-2 | `langsmith.json` valid JSON, `schema_version` `1.2`, `registries.components` populated | PASS | `schema_version: 1.2`; `components: ["http_fetch","json_bool","async_worker"]` |
| EXP-CHK-3 | Round-trip — `componentRegistry` + custom node `config` preserved | PASS | `componentRegistry count: 3`, `custom node count: 4`; `http-1` config (incl. `verify_ssl:false`, secret env name) preserved verbatim |
| EXP-CHK-4 | `py_compile` on all generated `.py` files | PASS | `PY_COMPILE_ALL: PASS` (syntax only — see EXP-001) |
| EXP-CHK-5 | Generated code **semantically valid** for every config-field kind | **FAIL** | `json` field with `true`/`false`/`null` emits `cfg = {"flag":true,"off":false,"none":null}` → `RUNTIME_NameError: name 'true' is not defined` |
| EXP-CHK-6 | Safe templating — no `eval`/`new Function`, secrets as env | PASS | `templateEngine.ts` is pure regex; secret emits `os.environ.get("MY_SECRET_ENV")`, never inlined; `import os` always present |
| EXP-CHK-7 | Custom imports hoisted + deduped + sorted | PASS | manifest imports collected once at module top: `from urllib.parse import urlparse` / `import asyncio` / `import httpx` |
| EXP-CHK-8 | Missing-manifest node → valid stub | PASS | `def missing_1(...): """Missing component: does_not_exist""" return {}`; graph still wires `add_node`/edges |
| EXP-CHK-9 | `async: true` manifest → `async def` | PASS | `async def aw_1(state: State) -> dict:` |
| EXP-CHK-10 | Portable `.component.json` round-trip + `validateManifest` | PASS | serialize → `parseComponentFile` errors `[]`; id + 7 fields preserved |
| EXP-CHK-11 | `.raw` (code field) re-indent to placeholder column | PASS | `transform.raw` multi-line block re-indented to 4 spaces correctly |
| EXP-CHK-12 | `code`/`string`/`select` escaped as safe Python string literals | PASS | `JSON.stringify`-based escaping yields valid Python `str` (newlines, quotes, backslashes) |

---

## Defects

### EXP-001 — `json` config field emits invalid Python for boolean/null values (P0)

| | |
|--|--|
| FR | FR-2 (json config-field kind) / FR-5 / NFR-3 (export is the contract) |
| Severity | **P0 — generated code raises `NameError` at runtime** |
| File | `src/lib/codegen/templateEngine.ts` → `toPythonJson()` (line ~46) |

**Issue.** For `kind: 'json'`, `toPythonJson` returns `JSON.stringify(JSON.parse(raw))`, i.e. the **JSON text**. JSON booleans/null (`true`/`false`/`null`) are **not valid Python literals** (`True`/`False`/`None`). The LLD §5.4 claims json is "valid Python for the dict/list/scalar subset" — this is false for the boolean/null scalars, which are part of the JSON scalar set.

**Reproduction (harness).** A `json` field defaulting to `{"flag": true, "off": false, "none": null}` generated:

```python
def jb_1(state: State) -> dict:
    cfg = {"flag":true,"off":false,"none":null}
    return {"cfg": cfg}
```

`py_compile` **passes** (these are valid identifier references), but execution fails:

```
RUNTIME_NameError: name 'true' is not defined
```

So the bundle ships, imports fine, and breaks only when the node runs — the worst failure mode for "export is the contract". (json fields with only strings/numbers/nested objects, e.g. `{"Authorization":"x","n":5}`, are fine.)

**Suggested fix.** In `toPythonJson`, do not re-emit JSON text. Convert the parsed value to a Python literal recursively: `true→True`, `false→False`, `null→None` (and keep strings/numbers/nested as-is). A small `jsonToPyLiteral(parsed)` helper (or map the three scalar tokens) restores the documented contract. Add a `templateEngine` unit case for `json` with bool/null.

---

### EXP-002 — Raw (unescaped) substitution of `{{label}}`/`{{description}}`/`{{outputKey}}`/`{{nodeName}}` (advisory / low)

| | |
|--|--|
| FR | NFR-4 (codegen safety) |
| Severity | **Low — advisory** (consistent with existing generators; author/IDE-controlled) |
| File | `src/lib/codegen/templateEngine.ts` `renderTemplate` (top-level token branch) |

**Issue.** The four scalar tokens are substituted verbatim into the template. A node `label`/`description` containing `"""`, a newline, or a backslash can break a generated docstring/string literal (e.g. template `"""{{label}} — {{description}}"""`). This is the same behavior as the existing `llm`/`tool` cases (which also interpolate `data.label`/`data.description` into docstrings unescaped), so it is **not a regression** and is data the author typed in the IDE — hence advisory, not blocking. Consider, in a later pass, escaping these when they land inside a Python string context, or documenting that templates must place them only in comment/docstring positions.

---

## What PASSED (highlights, with evidence)

- **NFR-4 safe templating**: no `eval`/`new Function`/dynamic import anywhere in `templateEngine.ts`; secret fields never inlined (`os.environ.get(...)`); icon/field-kind whitelists enforced in `componentIO.validateManifest`.
- **NFR-3 round-trip**: `exportGraphDocument` spreads the full doc; `componentRegistry` (3) and per-node `config` survive serialize→parse byte-equivalent; `server/main.py DOCUMENT_KEYS` includes `componentRegistry` (static-confirmed) for save/import/git/restore.
- **langsmith.json**: additive `registries.components` + `schema_version: '1.2'`; backward compatible (older bundles simply lack the key).
- **Import hoisting**: cross-node dedupe + sort, hoisted next to `import os` / langgraph imports.
- **Resilience**: missing manifest → valid `"""Missing component"""` stub; export stays syntactically valid.
- **Portability**: `.component.json` wrapper (`langstitchComponent: '1.0'`) round-trips through `serializeComponent`/`parseComponentFile` with full validation.

---

## Handoff

**FAILED** → **feature-implementer**: fix **EXP-001** (json bool/null → Python literal). EXP-002 is advisory and may be deferred. Re-run **full** export checks (not just EXP-CHK-5) on redelivery before **feature-automation-author**.

> Export/codegen **FAILED** — 1 P0 defect (EXP-001), 1 advisory (EXP-002). Hand to **feature-implementer** before automation.
