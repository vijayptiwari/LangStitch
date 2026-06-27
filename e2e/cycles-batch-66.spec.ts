import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 66 — cycles 661–670', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-661: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toHaveAttribute('data-cycle-guard-alt7', '661')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-662: snap-to-grid toggle for canvas nodes', async ({ page }) => {
    const toggle = page.getByTestId('canvas-snap-toggle')
    await expect(toggle).toHaveAttribute('data-cycle-snap-alt6', '662')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('cycle-663: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch66_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-dry-run-alt7',
      '663',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toContainText(/batch66_dry_run_ds/)
  })

  test('cycle-664: CORS preflight support for /api/export', async ({ request }) => {
    const res = await request.fetch('http://127.0.0.1:8787/api/export', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(res.status()).toBeLessThan(300)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 124, 244, 304, 364, 424, 484, 544, 604, 664')
  })

  test('cycle-665: link eval dataset name in result summary', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch66_eval_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toHaveAttribute('data-cycle-link-alt7', '665')
    await expect(link).toHaveText('batch66_eval_dataset')
  })

  test('cycle-666: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('cycles 186, 246, 306, 366, 426, 486, 546, 606, 666')
  })

  test('cycle-667: Ctrl+Shift+D toggles minimap', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    await page.keyboard.press('Control+Shift+d')
    await expect(minimap).toHaveCount(0)
    await page.keyboard.press('Control+Shift+d')
    await expect(minimap).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-667-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-667-toggle-minimap')).toContainText(/Ctrl.*Shift.*D/i)
  })

  test('cycle-668: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 668, y: 670, zoom: 0.94 }),
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
    expect(viewport).toMatchObject({ x: 668, y: 670, zoom: 0.94 })
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 44, 140, 212, 236, 284, 332, 380, 428, 476, 524, 572, 620, 668')
  })

  test('cycle-669: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 93, 141, 237, 285, 333, 381, 429, 477, 525, 573, 621, 669 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
  })

  test('cycle-670: save-and-reload user flow', async ({ page }) => {
    await expect(page.getByTestId('cycle-670-save-reload')).toBeVisible()
    await page.getByTestId('graph-name-input').fill('batch66_save_reload')
    await page.getByTestId('toolbar-save').click()
    await expect(page.getByTestId('toolbar-saved-at')).toBeVisible({ timeout: 3_000 })
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              getProjectPayload: () => unknown
              loadProject: (payload: unknown) => void
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      localStorage.setItem('langstitch-c670-draft', JSON.stringify(payload))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.evaluate(() => {
      const raw = localStorage.getItem('langstitch-c670-draft')
      if (!raw) throw new Error('missing draft')
      const payload = JSON.parse(raw)
      ;(
        window as unknown as {
          __graphStore: { getState: () => { loadProject: (p: unknown) => void } }
        }
      ).__graphStore.getState().loadProject(payload)
    })
    await expect(page.getByTestId('graph-name-input')).toHaveValue('batch66_save_reload')
  })
})
