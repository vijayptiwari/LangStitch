import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 38 — cycles 381–390', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-381: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 93, 141, 237, 285, 333, 381 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
    expect(source).toContain('/** Persist pan/zoom for the active subgraph (also writes localStorage). */')
  })

  test('cycle-382: eval-dry-run user flow via Validate config', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              updateGraphSettings: (s: {
                observability: {
                  enabled: boolean
                  langsmith: { enabled: boolean; projectName: string; apiKeyEnv: string }
                }
                eval: { enabled: boolean; datasetName: string; datasetId: string }
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      store.updateGraphSettings({
        observability: {
          enabled: true,
          langsmith: { enabled: true, projectName: 'test', apiKeyEnv: 'LANGCHAIN_API_KEY' },
        },
        eval: { enabled: true, datasetName: 'batch38_dry_run_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-experiment-prefix').fill('batch38_cycle_382')
    const validate = page.getByTestId('eval-validate-config')
    await expect(validate).toHaveAttribute('data-cycle-dry-run-alt', '382')
    await expect(page.getByTestId('cycle-382-eval-dry-run')).toBeAttached()
    await validate.click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('eval-result')).toContainText(/valid|dry|config/i)
  })

  test('cycle-383: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    const kbd = page.getByTestId('toolbar-platform-kbd')
    await expect(kbd).toHaveText('Ctrl+E')
    await expect(kbd).toHaveAttribute('data-cycle-kbd-alt', '383')
  })

  test('cycle-384: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-384-health-last-sync')).toBeAttached()
    await expect(page.getByTestId('platform-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-385: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('guardrail-validation-error').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
    await expect(page.getByTestId('cycle-385-guardrail-validation').last()).toBeAttached()
  })

  test('cycle-386: multi-select delete shows confirmation dialog', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-multi-alt2', '386')
    await page.keyboard.down('Shift')
    await page.locator('.react-flow__viewport .react-flow__node[data-id="fn-1"]').click({ force: true })
    await page.locator('.react-flow__viewport .react-flow__node[data-id="tool-1"]').click({ force: true })
    await page.keyboard.up('Shift')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete 2 selected nodes/)
      dialog.dismiss()
    })
    await page.keyboard.press('Delete')
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('data-cycle-multi-alt2="386"')
  })

  test('cycle-387: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'batch38_regression_suite',
        datasetId: '',
        experimentPrefix: 'regression',
        maxConcurrency: 4,
        description: 'batch38',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: batch38_regression_suite')
    const source = readFileSync('src/lib/codegen/pythonGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 87, 147, 207, 267, 327, 387')
  })

  test('cycle-388: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 148, 208, 268, 328, 388')
  })

  test('cycle-389: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('cycle-389-regression-preset')).toBeVisible()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(
      EVAL_PRESET_REGRESSION.experimentPrefix,
    )
  })

  test('cycle-390: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await expect(page.getByTestId('cycle-390-skip-link')).toBeAttached()
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
