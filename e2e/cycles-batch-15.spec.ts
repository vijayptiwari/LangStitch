import { readFileSync } from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'

const FIXTURE = path.join('e2e', 'fixtures', 'basic-agent.langstitch.json')

test.describe('SDLC Batch 15 — cycles 151–160', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-151: Alt+L focuses node palette search', async ({ page }) => {
    const search = page.getByTestId('palette-search-input')
    await expect(search).toBeVisible()
    await page.keyboard.press('Alt+l')
    await expect(search).toBeFocused()
    await search.fill('llm')
    await expect(page.getByTestId('palette-llm')).toBeVisible()
    await expect(page.getByTestId('palette-start')).toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-151-alt-l-focus-search')).toBeVisible()
  })

  test('cycle-152: dirty flag clears after successful import', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __graphStore: { getState: () => {
        setDocumentMeta: (m: { name: string }) => void
      } } }).__graphStore.getState().setDocumentMeta({ name: 'Dirty Graph Name' })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toBeVisible()
    const raw = readFileSync(FIXTURE, 'utf-8')
    const afterLoad = await page.evaluate((json) => {
      const payload = JSON.parse(json) as Record<string, unknown>
      const { canvasByGraph, navigationPath, ...docFields } = payload
      const api = (window as unknown as { __graphStore: { getState: () => {
        loadProject: (p: unknown) => void
        isDirty: boolean
        document: { name: string }
      } } }).__graphStore
      api.getState().loadProject({ document: docFields, canvasByGraph, navigationPath })
      const s = api.getState()
      return { isDirty: s.isDirty, name: s.document.name }
    }, raw)
    expect(afterLoad.isDirty).toBe(false)
    expect(afterLoad.name).toBe('basic_agent')
    await page.waitForFunction(() => {
      const s = (window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }).__graphStore.getState()
      return !s.isDirty
    }, undefined, { timeout: 10_000 })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycle 152')
  })

  test('cycle-153: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /langstitch\.com\/docs/)
    await expect(page.getByTestId('cycle-153-docs-tooltip')).toBeAttached()
  })

  test('cycle-154: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-154-health-reload')).toBeAttached()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { build_time?: string; version?: string }
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.version).toBeTruthy()
  })

  test('cycle-155: toolbar redo disabled when graph is empty', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as { __graphStore: { getState: () => {
        nodes: { id: string; data: { kind: string } }[]
        removeNode: (id: string) => void
        resetProject: () => void
      } } }).__graphStore.getState()
      store.resetProject()
      const toRemove = store.nodes.filter(
        (n) => n.data.kind !== 'start' && n.data.kind !== 'end',
      )
      for (const n of toRemove) {
        store.removeNode(n.id)
      }
    })
    await expect(page.getByTestId('cycle-155-redo-empty-guard')).toBeVisible()
    await expect(page.getByTestId('toolbar-redo')).toBeDisabled()
  })

  test('cycle-156: export retry button on Platform Export API error', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/export', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({ status: 500, body: 'Export failed' })
      } else {
        await route.continue()
      }
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('export-error')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('export-retry')).toBeVisible()
    await expect(page.getByTestId('export-retry')).toHaveAttribute('data-cycle', '156')
  })

  test('cycle-157: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-cycle="157"]').last()
    await desc.fill('Test guardrail description')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('26/500')
  })

  test('cycle-158: snap-to-grid toggle for canvas nodes', async ({ page }) => {
    const toggle = page.getByTestId('canvas-snap-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-cycle', '158')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('cycle-159: export validation warning for missing eval-dataset', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as { __graphStore: { getState: () => {
        updateGraphSettings: (s: { eval: { enabled: boolean; datasetName: string; datasetId: string; experimentPrefix: string; maxConcurrency: number; description: string } }) => void
      } } }).__graphStore.getState()
      store.updateGraphSettings({
        eval: {
          enabled: true,
          datasetName: '',
          datasetId: '',
          experimentPrefix: '',
          maxConcurrency: 2,
          description: '',
        },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await expect(page.getByTestId('export-eval-dataset-warning')).toBeVisible()
    await expect(page.getByTestId('cycle-159-eval-warning')).toContainText(/eval-dataset/i)
  })

  test('cycle-160: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch15',
      format: 'python',
      files: { 'langstitch.project.json': '{}' },
    }
    for (let i = 0; i < 5; i++) {
      const res = await request.post('http://127.0.0.1:8787/api/export', { data: body })
      expect(res.status()).toBe(200)
    }
    const limited = await request.post('http://127.0.0.1:8787/api/export', { data: body })
    expect(limited.status()).toBe(429)
    const json = (await limited.json()) as { detail: string }
    expect(json.detail).toMatch(/Too many export requests/i)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycle 160')
  })
})
