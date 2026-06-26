import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 14 — cycles 141–150', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-141: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycle 141 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('Merges imported viewport with localStorage')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
    expect(source).toContain('/** Persist pan/zoom for the active subgraph (also writes localStorage). */')
  })

  test('cycle-142: toolbar-save is visible', async ({ page }) => {
    const saveWrap = page.getByTestId('cycle-142-toolbar-save')
    await expect(saveWrap).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-143: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    await expect(page.getByTestId('toolbar-platform-kbd')).toHaveText('Ctrl+E')
    const hint = page.getByTestId('cycle-143-platform-hint')
    await expect(hint).toBeAttached()
    await expect(hint).toContainText(/cycle 143/i)
    await expect(hint).toContainText(/Ctrl\+E/i)
  })

  test('cycle-144: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-144-health-last-sync')).toBeVisible()
    await expect(page.getByTestId('cycle-144-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-145: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('cycle-145-guardrail-validation').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
  })

  test('cycle-146: canvas context menu delete node', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await expect(node).toBeVisible()
    await node.click({ button: 'right', force: true })
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
    await expect(page.getByTestId('cycle-146-context-delete')).toBeVisible()
    await page.getByTestId('canvas-context-delete').click()
    await expect(node).toHaveCount(0)
  })

  test('cycle-147: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'batch14_regression_ds',
        datasetId: '',
        experimentPrefix: 'batch14',
        maxConcurrency: 4,
        description: 'batch14',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: batch14_regression_ds')
    const source = readFileSync('src/lib/codegen/pythonGenerator.ts', 'utf-8')
    expect(source).toContain('cycle 147')
  })

  test('cycle-148: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycle 148')
  })

  test('cycle-149: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('cycle-149-regression-preset')).toBeVisible()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(EVAL_PRESET_REGRESSION.experimentPrefix)
  })

  test('cycle-150: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await expect(page.getByTestId('cycle-150-skip-link')).toBeVisible()
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
