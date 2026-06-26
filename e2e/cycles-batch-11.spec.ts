import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { buildExportBundle } from '../src/lib/codegen/bundleGenerator'
import { createDefaultDocument, exportGraphDocument } from '../src/lib/codegen/pythonGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 11 — cycles 111–120', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-111: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch11_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch11_manifest_ds/)
    await expect(preview).toContainText(/export-manifest\.json/)
  })

  test('cycle-111: buildExportBundle includes eval-dataset in manifest', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch11_unit_ds' },
    }
    const projectJson = exportGraphDocument(doc, [], [], {}, [doc.activeSubgraphId])
    const files = buildExportBundle(doc, projectJson, '', 'python')
    expect(files['export-manifest.json']).toBeTruthy()
    const manifest = JSON.parse(files['export-manifest.json']) as {
      'eval-dataset'?: { dataset_name: string }
      files: string[]
    }
    expect(manifest['eval-dataset']?.dataset_name).toBe('batch11_unit_ds')
    expect(manifest.files).toContain('export-manifest.json')
  })

  test('cycle-112: OpenAPI-style description for /api/export', async ({ request }) => {
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

  test('cycle-113: eval history last-113 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 120 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch11_hist_${i}`,
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
      if (!raw) return 0
      return (JSON.parse(raw) as unknown[]).length
    })
    expect(count).toBeLessThanOrEqual(113)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 113')
  })

  test('cycle-114: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch11_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
    await expect(live).toHaveAttribute('aria-live', 'polite')
  })

  test('cycle-115: Alt+H toggles platform drawer', async ({ page }) => {
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('Alt+h')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Alt+h')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
  })

  test('cycle-115: shortcuts modal documents Alt+H', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('cycle-115-alt-h-platform')).toBeVisible()
    await expect(page.getByTestId('cycle-115-alt-h-platform')).toContainText(/Alt.*H.*Platform/i)
  })

  test('cycle-116: graph store persists viewport in localStorage', async ({ page }) => {
    const projectName = await page.evaluate(() =>
      (
        window as unknown as {
          __graphStore: { getState: () => { document: { name: string } } }
        }
      ).__graphStore.getState().document.name,
    )
    const key = viewportStorageKey(projectName)
    expect(key.startsWith(VIEWPORT_STORAGE_PREFIX)).toBeTruthy()
    await page.locator('.react-flow__controls button').first().click()
    await page.waitForTimeout(400)
    const stored = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as { x: number; y: number; zoom: number }
    expect(typeof parsed.zoom).toBe('number')
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const afterReload = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
    expect(afterReload).toBeTruthy()
  })

  test('cycle-116: viewportStorageKey matches project name', () => {
    expect(viewportStorageKey('My Workflow')).toBe('langstitch-viewport-My Workflow')
  })

  test('cycle-117: README section keyboard shortcuts', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Keyboard shortcuts')
    expect(readme).toContain('Ctrl+S')
    expect(readme).toContain('Alt+H')
    expect(readme).toContain('Toggle Platform drawer')
  })

  test('cycle-118: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { build_time?: string; version?: string; 'node-count'?: number }
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.version).toBeTruthy()
    expect(typeof body['node-count']).toBe('number')
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
  })

  test('cycle-119: persist toolbar platform last-used tab', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('platform-tab-deploy')).toHaveClass(/active/)
    const stored = await page.evaluate(() => localStorage.getItem('langstitch-platform-tab-last-used'))
    expect(stored).toBe('deploy')
    await page.getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-tab-deploy')).toHaveClass(/active/)
    const restored = await page.evaluate(() => localStorage.getItem('langstitch-platform-tab-last-used'))
    expect(restored).toBe('deploy')
  })

  test('cycle-120: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
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
        eval: { enabled: true, datasetName: 'batch11_copy', datasetId: '' },
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('git-output-copy').click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/Export|bundle|Git|Eval/i)
  })
})
