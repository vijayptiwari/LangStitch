import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument, generatePythonCode } from '../src/lib/codegen/pythonGenerator'
import { EVAL_PRESET_REGRESSION } from '../src/lib/designerConstants'

test.describe('SDLC Batch 62 — cycles 621–630', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-621: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 93, 141, 237, 285, 333, 381, 429, 477, 525, 573, 621 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
  })

  test('cycle-622: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-622-health-reload')).toBeAttached()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { build_time?: string; version?: string }
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.version).toBeTruthy()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
  })

  test('cycle-623: toolbar platform shows Ctrl+E keyboard hint', async ({ page }) => {
    const platformBtn = page.getByTestId('toolbar-platform')
    await expect(platformBtn).toHaveAttribute('title', 'Platform (Ctrl+E)')
    const kbd = page.getByTestId('toolbar-platform-kbd')
    await expect(kbd).toHaveText('Ctrl+E')
    await expect(kbd).toHaveAttribute('data-cycle-kbd-alt3', '623')
    await expect(page.getByTestId('cycle-623-platform-hint')).toBeAttached()
  })

  test('cycle-624: platform health shows last-sync timestamp', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-624-health-last-sync')).toBeAttached()
    await expect(page.getByTestId('platform-health-last-sync')).toContainText(/Last sync:/i)
  })

  test('cycle-625: guardrail validation error when policy empty', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const policy = page.locator('[data-testid^="guardrail-policy-"]').last()
    await policy.fill('')
    const validation = page.getByTestId('guardrail-validation-error').last()
    await expect(validation).toBeVisible()
    await expect(validation).toContainText(/required/i)
    await expect(page.getByTestId('cycle-625-guardrail-validation').last()).toBeAttached()
  })

  test('cycle-626: edge label truncation with tooltip', async ({ page }) => {
    const longLabel = 'very_long_branch_label_for_truncation_test_cycle_626'
    await page.evaluate((label) => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              setEdges: (
                edges: { id: string; source: string; target: string; label: string; type: string }[],
              ) => void
              edges: { id: string }[]
            }
          }
        }
      ).__graphStore.getState()
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label-626',
          source: 'llm-1',
          target: 'decision-1',
          label,
          type: 'truncated',
        },
      ] as never)
    }, longLabel)
    const label = page.getByTestId('edge-label-e-long-label-626')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('data-cycle-truncate-alt5', '626')
    await expect(label).toHaveAttribute('title', longLabel)
    await expect(label).toContainText(/…/)
  })

  test('cycle-627: generated Python includes eval-dataset comment header', async () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: {
        enabled: true,
        datasetName: 'batch62_regression_suite',
        datasetId: '',
        experimentPrefix: 'batch62',
        maxConcurrency: 4,
        description: 'batch62 cycle 627',
      },
    }
    const code = generatePythonCode(doc, [], [])
    expect(code).toContain('Eval dataset: batch62_regression_suite')
    const source = readFileSync('src/lib/codegen/pythonGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 87, 147, 207, 267, 327, 387, 447, 507, 567, 627')
  })

  test('cycle-628: health API returns X-Request-ID header', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const requestId = res.headers()['x-request-id']
    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 148, 208, 268, 328, 388, 448, 508, 568, 628')
  })

  test('cycle-629: regression eval preset fills config fields', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('cycle-629-regression-preset')).toBeVisible()
    await page.getByTestId('eval-preset-regression').click()
    await expect(page.getByTestId('eval-dataset-name')).toHaveValue(EVAL_PRESET_REGRESSION.datasetName)
    await expect(page.getByTestId('eval-experiment-prefix')).toHaveValue(
      EVAL_PRESET_REGRESSION.experimentPrefix,
    )
  })

  test('cycle-630: skip link targets main canvas region', async ({ page }) => {
    const skip = page.getByTestId('skip-to-canvas')
    await expect(skip).toHaveAttribute('href', '#graph-canvas-main')
    await expect(page.getByTestId('cycle-630-skip-link')).toBeAttached()
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#graph-canvas-main')).toBeFocused()
  })
})
