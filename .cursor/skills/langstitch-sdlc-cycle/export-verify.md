# LangStitch Export Verification Reference

Used by **export-codegen-validator**, **feature-automation-author**, and UAT.

## Codegen entry points

| Function | File |
|----------|------|
| `exportGraphDocument` | `src/lib/codegen/pythonGenerator.ts` |
| `generatePythonProject` | `src/lib/codegen/pythonProjectGenerator.ts` |
| `generateLangsmithJson` | `src/lib/codegen/pythonProjectGenerator.ts` |
| `buildExportBundle` | `src/lib/codegen/bundleGenerator.ts` |

## Export formats

`ExportFormat`: `'python' | 'spring' | 'full'`

## P0 checks (export in scope)

1. `npm run build` passes
2. ZIP downloads from Platform drawer or API
3. ZIP contains `pyproject.toml` + `langsmith.json` (python/full)
4. `langsmith.json` is valid JSON with expected observability keys
5. Python modules pass `python -m py_compile`
6. Round-trip: re-import preserves graph name + node count (per LLD)
7. UI `code-block` preview contains `StateGraph` + graph name when FR requires
8. `python runtime/basic_agent.py` passes (regression)

## Playwright export pattern

```typescript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export/i }).click(),
])
const path = await download.path()
// assert zip contents
```

## Fixtures

- `e2e/fixtures/basic-agent.langstitch.json` — baseline 4-node agent
- Add feature-specific fixtures under `e2e/fixtures/`

## Platform API

- Health: `GET http://127.0.0.1:8787/api/health`
- Export bundle: via `platformApi.exportBundle` (see `PlatformDrawer.tsx`)

## Failure routing

Export failures → **EXP-*** → **feature-implementer** → re-run **export-codegen-validator** before automation.
