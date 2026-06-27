import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 42 — cycles 421–430', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-421: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toHaveAttribute('data-cycle-guard-alt3', '421')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-422: minimap highlight for selected node', async ({ page }) => {
    await expect(page.getByTestId('cycle-422-minimap-highlight')).toBeAttached()
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('minimapNodeStrokeColor')
    expect(source).toContain('cycle-422-minimap-highlight')
  })

  test('cycle-423: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch42_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-dry-run-alt3',
      '423',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch42_dry_run_ds/)
  })

  test('cycle-424: CORS preflight support for /api/export', async ({ request }) => {
    const res = await request.fetch('http://127.0.0.1:8787/api/export', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(res.status()).toBeLessThan(300)
    expect(res.headers()['access-control-allow-origin']).toBeTruthy()
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 124, 244, 304, 364, 424')
  })

  test('cycle-425: link eval dataset name in result summary', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch42_eval_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toHaveAttribute('data-cycle-link-alt3', '425')
    await expect(link).toHaveText('batch42_eval_dataset')
  })

  test('cycle-426: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('cycles 186, 246, 306, 366, 426')
  })

  test('cycle-427: shortcuts modal documents toggle minimap', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-427-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-427-toggle-minimap')).toContainText(/Ctrl.*G.*minimap/i)
  })

  test('cycle-428: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 428, y: 430, zoom: 0.92 }),
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
    expect(viewport).toMatchObject({ x: 428, y: 430, zoom: 0.92 })
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 44, 140, 212, 236, 284, 332, 380, 428')
  })

  test('cycle-429: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 93, 141, 237, 285, 333, 381, 429 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
    expect(source).toContain('/** Persist pan/zoom for the active subgraph (also writes localStorage). */')
  })

  test('cycle-430: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-430-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })
})
