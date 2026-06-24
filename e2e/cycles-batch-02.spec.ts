import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 2 — cycles 21–30', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-21: README documents export formats', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Export formats')
    expect(readme).toContain('| **Python** | `python` |')
    expect(readme).toContain('| **Full bundle** | `full` |')
  })

  test('cycle-22: eval-dry-run user flow via Validate config @p0', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch2_dry_run_dataset')
    await page.getByTestId('eval-experiment-prefix').fill('batch2_cycle_22')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('eval-result')).toContainText(/valid|dry|config/i)
  })

  test('cycle-23: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    await expect(page.getByTestId('toolbar-platform-kbd')).toHaveText('Ctrl+E')
  })

  test('cycle-24: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('platform-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-25: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('guardrail-validation-error').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
  })

  test('cycle-26: multi-select delete shows confirmation dialog', async ({ page }) => {
    await page.keyboard.down('Shift')
    await page.locator('.react-flow__viewport .react-flow__node[data-id="fn-1"]').click({ force: true })
    await page.locator('.react-flow__viewport .react-flow__node[data-id="tool-1"]').click({ force: true })
    await page.keyboard.up('Shift')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete 2 selected nodes/)
      dialog.dismiss()
    })
    await page.keyboard.press('Delete')
  })

  test('cycle-27: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'regression-suite',
        datasetId: '',
        experimentPrefix: 'regression',
        maxConcurrency: 4,
        description: 'batch2',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: regression-suite')
  })

  test('cycle-28: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  test('cycle-29: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(EVAL_PRESET_REGRESSION.experimentPrefix)
  })

  test('cycle-30: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
