import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 74 — cycles 741–750', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-741: README documents export formats', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Export formats <!-- cycle-261 --> <!-- cycle-501 --> <!-- cycle-741 -->')
    expect(readme).toContain('| **Python** | `python` |')
    expect(readme).toContain('| **Full bundle** | `full` |')
  })

  test('cycle-742: eval-dry-run user flow via Validate config', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch74_dry_run_dataset')
    await page.getByTestId('eval-experiment-prefix').fill('batch74_cycle_742')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('cycle-742-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('eval-result')).toContainText(/valid|dry|config/i)
  })

  test('cycle-743: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    const kbd = page.getByTestId('toolbar-platform-kbd')
    await expect(kbd).toHaveText('Ctrl+E')
    await expect(kbd).toHaveAttribute('data-cycle-kbd-alt4', '743')
    await expect(page.getByTestId('cycle-743-platform-hint')).toBeAttached()
  })

  test('cycle-744: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-744-health-last-sync')).toBeAttached()
    await expect(page.getByTestId('platform-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-745: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('guardrail-validation-error').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
    await expect(page.getByTestId('cycle-745-guardrail-validation').last()).toBeAttached()
  })

  test('cycle-746: multi-select delete shows confirmation dialog', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-multi-alt7', '746')
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
    expect(source).toContain('data-cycle-multi-alt7="746"')
  })

  test('cycle-747: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'batch74_regression_suite',
        datasetId: '',
        experimentPrefix: 'batch74',
        maxConcurrency: 4,
        description: 'batch74 cycle 747',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: batch74_regression_suite')
    const source = readFileSync('src/lib/codegen/pythonGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 87, 147, 207, 267, 327, 387, 447, 507, 567, 627, 687, 747')
  })

  test('cycle-748: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 148, 208, 268, 328, 388, 448, 508, 568, 628, 688, 748')
  })

  test('cycle-749: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('cycle-749-regression-preset')).toBeVisible()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(
      EVAL_PRESET_REGRESSION.experimentPrefix,
    )
  })

  test('cycle-750: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await expect(page.getByTestId('cycle-750-skip-link')).toBeAttached()
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
