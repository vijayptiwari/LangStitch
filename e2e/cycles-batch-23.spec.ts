import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { buildExportBundle } from '../src/lib/codegen/bundleGenerator'
import { createDefaultDocument, exportGraphDocument } from '../src/lib/codegen/pythonGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

test.describe('SDLC Batch 23 — cycles 231–240', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-231: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch23_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute('data-cycle-manifest', '231')
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch23_manifest_ds/)
  })

  test('cycle-231: buildExportBundle includes eval-dataset in manifest', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch23_unit_ds' },
    }
    const projectJson = exportGraphDocument(doc, [], [], {}, [doc.activeSubgraphId])
    const files = buildExportBundle(doc, projectJson, '', 'python')
    const manifest = JSON.parse(files['export-manifest.json']) as {
      'eval-dataset'?: { dataset_name: string }
    }
    expect(manifest['eval-dataset']?.dataset_name).toBe('batch23_unit_ds')
  })

  test('cycle-232: OpenAPI-style description for /api/export', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/openapi.json')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as {
      openapi?: string
      paths?: Record<string, { post?: { summary?: string; requestBody?: unknown } }>
    }
    expect(body.openapi).toMatch(/^3\./)
    expect(body.paths?.['/api/export']?.post?.summary).toMatch(/export/i)
    expect(body.paths?.['/api/export']?.post?.requestBody).toBeTruthy()
  })

  test('cycle-233: eval history last-233 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 240 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch23_hist_${i}`,
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
    expect(count).toBeLessThanOrEqual(233)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 233')
  })

  test('cycle-234: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch23_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live', '234')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
    await expect(live).toHaveAttribute('aria-live', 'polite')
  })

  test('cycle-235: Ctrl+L toggles platform drawer', async ({ page }) => {
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('Control+l')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Control+l')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-235-toggle-platform')).toBeVisible()
  })

  test('cycle-236: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 140, y: 95, zoom: 0.88 }),
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
      store.loadProject({
        document: payload.document,
        canvasByGraph: {
          main: { nodes: payload.nodes, edges: payload.edges },
        },
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
    expect(viewport).toMatchObject({ x: 140, y: 95, zoom: 0.88 })
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('Merges imported viewport with localStorage')
  })

  test('cycle-237: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycle 237')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
  })

  test('cycle-238: open-shortcuts user flow', async ({ page }) => {
    await page.keyboard.press('?')
    const modal = page.getByTestId('shortcuts-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toHaveAttribute('data-cycle', '238')
    await expect(modal).toContainText(/Keyboard shortcuts/i)
    await expect(modal).toContainText(/Save project/i)
    await page.getByTestId('cycle-78-focus-trap').getByRole('button', { name: 'Close' }).click()
    await expect(modal).toHaveCount(0)
  })

  test('cycle-239: persist toolbar platform last-used tab', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('cycle-239-platform-tab-persist')).toBeAttached()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('platform-tab-deploy')).toHaveClass(/active/)
    const stored = await page.evaluate(() => localStorage.getItem('langstitch-platform-tab-last-used'))
    expect(stored).toBe('deploy')
    await page.getByTestId('platform-drawer').getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-tab-deploy')).toHaveClass(/active/)
  })

  test('cycle-240: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch23-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle', '240')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/Export|bundle|Git|Eval/i)
  })
})
