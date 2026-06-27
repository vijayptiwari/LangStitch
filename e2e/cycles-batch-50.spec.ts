import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 50 — cycles 501–510', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-501: README documents export formats', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Export formats <!-- cycle-261 --> <!-- cycle-501 -->')
    expect(readme).toContain('| **Python** | `python` |')
    expect(readme).toContain('| **Full bundle** | `full` |')
  })

  test('cycle-502: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-502-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-503: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    const kbd = page.getByTestId('toolbar-platform-kbd')
    await expect(kbd).toHaveText('Ctrl+E')
    await expect(kbd).toHaveAttribute('data-cycle-kbd-alt2', '503')
  })

  test('cycle-504: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-504-health-last-sync')).toBeAttached()
    await expect(page.getByTestId('platform-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-505: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('guardrail-validation-error').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
    await expect(page.getByTestId('cycle-505-guardrail-validation').last()).toBeAttached()
  })

  test('cycle-506: canvas context menu item delete', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await expect(node).toBeVisible()
    await node.click({ button: 'right', force: true })
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
    await expect(page.getByTestId('cycle-506-context-delete')).toBeAttached()
    await page.getByTestId('canvas-context-delete').click()
    await expect(node).toHaveCount(0)
  })

  test('cycle-507: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'batch50_regression_suite',
        datasetId: '',
        experimentPrefix: 'regression',
        maxConcurrency: 4,
        description: 'batch50',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: batch50_regression_suite')
    const source = readFileSync('src/lib/codegen/pythonGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 87, 147, 207, 267, 327, 387, 447, 507')
  })

  test('cycle-508: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 148, 208, 268, 328, 388, 448, 508')
  })

  test('cycle-509: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('cycle-509-regression-preset')).toBeVisible()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(
      EVAL_PRESET_REGRESSION.experimentPrefix,
    )
  })

  test('cycle-510: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await expect(page.getByTestId('cycle-510-skip-link')).toBeAttached()
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
