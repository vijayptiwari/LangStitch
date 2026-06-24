import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { buildExportBundle } from '../src/lib/codegen/bundleGenerator'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { exportGraphDocument } from '../src/lib/codegen/pythonGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

test.describe('SDLC Batch 5 — cycles 51–60', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-51: export manifest lists eval-dataset in bundle', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              updateGraphSettings: (s: {
                eval: {
                  enabled: boolean
                  datasetName: string
                  datasetId: string
                }
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      store.updateGraphSettings({
        eval: { enabled: true, datasetName: 'batch5_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByText('Export manifest preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch5_manifest_ds/)
    await expect(preview).toContainText(/export-manifest\.json/)
  })

  test('cycle-51: buildExportBundle includes export-manifest.json with eval-dataset', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'unit_manifest_ds' },
    }
    const projectJson = exportGraphDocument(doc, [], [], {}, [doc.activeSubgraphId])
    const files = buildExportBundle(doc, projectJson, '', 'python')
    expect(files['export-manifest.json']).toBeTruthy()
    const manifest = JSON.parse(files['export-manifest.json']) as {
      'eval-dataset'?: { dataset_name: string }
      files: string[]
    }
    expect(manifest['eval-dataset']?.dataset_name).toBe('unit_manifest_ds')
    expect(manifest.files).toContain('export-manifest.json')
  })

  test('cycle-52: OpenAPI-style description for /api/export', async ({ request }) => {
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

  test('cycle-53: eval history last-53 runs in session', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch5_history_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-history-list')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('eval-history-item-0')).toContainText(/batch5_history_ds|dry-run/i)
    const count = await page.evaluate(() => {
      const raw = sessionStorage.getItem('langstitch-eval-history-my_langgraph')
      if (!raw) return 0
      return (JSON.parse(raw) as unknown[]).length
    })
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(53)
  })

  test('cycle-54: screen-reader live region announces eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch5_live_ds', datasetId: '' },
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

  test('cycle-55: Ctrl+K toggles platform drawer', async ({ page }) => {
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
  })

  test('cycle-55: shortcuts modal documents Ctrl+K', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Ctrl.*K.*Platform/i)
  })

  test('cycle-56: dirty flag clears after successful import', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Dirty Test Graph')
    await expect(page.getByTestId('graph-dirty-indicator')).toBeVisible()
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              getProjectPayload: () => {
                document: unknown
                nodes: unknown
                edges: unknown
                canvasByGraph: unknown
                navigationPath: string[]
              }
              loadProject: (p: unknown) => void
              isDirty: boolean
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      store.loadProject({
        document: { ...(payload.document as object), name: 'Imported Clean' },
        nodes: payload.nodes,
        edges: payload.edges,
        canvasByGraph: payload.canvasByGraph,
        navigationPath: payload.navigationPath,
      })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
    await page.evaluate(() => {
      const isDirty = (
        window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }
      ).__graphStore.getState().isDirty
      return isDirty
    }).then((dirty) => expect(dirty).toBe(false))
  })

  test('cycle-57: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /docs/i)
    await expect(link).toHaveAttribute('title', /documentation/i)
  })

  test('cycle-58: open-shortcuts user flow', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('shortcuts-modal')).toBeVisible()
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Keyboard shortcuts/i)
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Save project/i)
  })

  test('cycle-59: persist toolbar redo last-used option', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              resetProject: () => void
              canRedo: () => boolean
            }
          }
        }
      ).__graphStore.getState()
      store.resetProject()
    })
    await page.getByRole('button', { name: /Reset/i }).click()
    await page.getByTestId('toolbar-redo').click()
    const stored = await page.evaluate(() => localStorage.getItem('langstitch-toolbar-redo-last-used'))
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as { at?: string; graphName?: string }
    expect(parsed.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    await expect(page.getByTestId('toolbar-redo-persisted')).toContainText(parsed.at!)
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const restored = await page.evaluate(() => localStorage.getItem('langstitch-toolbar-redo-last-used'))
    expect(restored).toBe(stored)
  })

  test('cycle-60: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
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
        eval: { enabled: true, datasetName: 'copy_test', datasetId: '' },
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

  test('cycle-52: server main.py defines openapi route', async () => {
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('@app.get("/api/openapi.json")')
    expect(source).toContain('"/api/export"')
  })
})
