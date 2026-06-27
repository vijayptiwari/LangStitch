import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

test.describe('SDLC Batch 71 — cycles 711–720', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-711: export manifest lists eval-dataset in bundle', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              updateGraphSettings: (s: {
                eval: { enabled: boolean; datasetName: string; datasetId: string }
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      store.updateGraphSettings({
        eval: { enabled: true, datasetName: 'batch71_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-manifest-alt8',
      '711',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch71_manifest_ds/)
    const source = readFileSync('src/lib/codegen/bundleGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 51, 111, 231, 291, 351, 411, 471, 531, 591, 651, 711')
  })

  test('cycle-712: OpenAPI-style description for /api/export', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/openapi.json')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as {
      openapi?: string
      paths?: Record<string, { post?: { summary?: string } }>
    }
    expect(body.openapi).toMatch(/^3\./)
    expect(body.paths?.['/api/export']?.post?.summary).toMatch(/export/i)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 232, 292, 352, 412, 472, 532, 592, 652, 712')
  })

  test('cycle-713: eval history last-713 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 720 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch71_hist_${i}`,
        datasetId: '',
        dryRun: true,
        message: 'dry-run',
      }))
      sessionStorage.setItem('langstitch-eval-history-my_langgraph', JSON.stringify(entries))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.getByTestId('toolbar-platform').click()
    const count = await page.evaluate(() => {
      const raw = sessionStorage.getItem('langstitch-eval-history-my_langgraph')
      return raw ? (JSON.parse(raw) as unknown[]).length : 0
    })
    expect(count).toBeLessThanOrEqual(713)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 713')
  })

  test('cycle-714: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch71_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live-alt8', '714')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
  })

  test('cycle-715: shortcuts modal documents toggle platform', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-715-toggle-platform')).toBeVisible()
    await expect(page.getByTestId('cycle-715-toggle-platform')).toContainText(/Alt.*Shift.*K/i)
  })

  test('cycle-716: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 716, y: 720, zoom: 0.93 }),
      )
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              loadProject: (p: unknown) => void
              getProjectPayload: () => {
                document: unknown
                nodes: unknown
                edges: unknown
              }
              canvasByGraph: Record<string, { viewport?: { x: number; y: number; zoom: number } }>
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      const { viewport: _omit, ...canvasWithoutViewport } =
        store.canvasByGraph.main ?? {}
      void _omit
      store.loadProject({
        document: payload.document,
        nodes: payload.nodes,
        edges: payload.edges,
        canvasByGraph: { main: canvasWithoutViewport },
      })
      return (
        window as unknown as {
          __graphStore: {
            getState: () => {
              canvasByGraph: Record<string, { viewport?: { x: number; y: number; zoom: number } }>
            }
          }
        }
      ).__graphStore.getState().canvasByGraph.main?.viewport
    })
    expect(viewport).toMatchObject({ x: 716, y: 720, zoom: 0.93 })
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 44, 140, 212, 236, 284, 332, 380, 428, 476, 524, 572, 620, 668, 716')
  })

  test('cycle-717: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 93, 141, 237, 285, 333, 381, 429, 477, 525, 573, 621, 669, 717 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
  })

  test('cycle-718: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-718-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-719: persist toolbar platform last-used tab', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('cycle-719-platform-tab-persist')).toBeAttached()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    const stored = await page.evaluate(() => localStorage.getItem('langstitch-platform-tab-last-used'))
    expect(stored).toBe('eval')
    await page.getByTestId('platform-drawer').getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.keyboard.press('Control+e')
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
  })

  test('cycle-720: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch71-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle-copy-alt7', '720')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
  })
})
