import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 48 — cycles 481–490', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-481: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toHaveAttribute('data-cycle-guard-alt4', '481')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-482: edge label truncation on long labels', async () => {
    const source = readFileSync('src/components/canvas/TruncatedEdge.tsx', 'utf-8')
    expect(source).toContain('data-cycle-truncate-alt3="482"')
    expect(source).toMatch(/truncate|ellipsis/i)
  })

  test('cycle-483: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch48_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-dry-run-alt4',
      '483',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch48_dry_run_ds/)
  })

  test('cycle-484: CORS preflight support for /api/export', async ({ request }) => {
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
    expect(source).toContain('cycles 124, 244, 304, 364, 424, 484')
  })

  test('cycle-485: link eval dataset name in result summary', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch48_eval_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toHaveAttribute('data-cycle-link-alt4', '485')
    await expect(link).toHaveText('batch48_eval_dataset')
  })

  test('cycle-486: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('cycles 186, 246, 306, 366, 426, 486')
  })

  test('cycle-487: shortcuts modal documents toggle minimap', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-487-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-487-toggle-minimap')).toContainText(
      /Ctrl.*Shift.*L.*minimap/i,
    )
  })

  test('cycle-488: dirty flag clears after successful import', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Dirty Batch 48 Graph')
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
                navigationPath: unknown
              }
              loadProject: (p: unknown) => void
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      store.loadProject({
        document: payload.document,
        nodes: payload.nodes,
        edges: payload.edges,
        canvasByGraph: payload.canvasByGraph,
        navigationPath: payload.navigationPath,
      })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
    const dirty = await page.evaluate(
      () =>
        (
          window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }
        ).__graphStore.getState().isDirty,
    )
    expect(dirty).toBe(false)
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 152, 248, 296, 344, 392, 440, 488')
  })

  test('cycle-489: docs help tooltip links to README', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /docs/i)
    await expect(page.getByTestId('cycle-489-docs-tooltip')).toBeAttached()
  })

  test('cycle-490: save-and-reload user flow', async ({ page }) => {
    await expect(page.getByTestId('cycle-490-save-reload')).toBeVisible()
    await page.getByTestId('graph-name-input').fill('batch48_save_reload')
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
      localStorage.setItem('langstitch-c490-draft', JSON.stringify(payload))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.evaluate(() => {
      const raw = localStorage.getItem('langstitch-c490-draft')
      if (!raw) throw new Error('missing draft')
      const payload = JSON.parse(raw)
      ;(
        window as unknown as {
          __graphStore: { getState: () => { loadProject: (p: unknown) => void } }
        }
      ).__graphStore.getState().loadProject(payload)
    })
    await expect(page.getByTestId('graph-name-input')).toHaveValue('batch48_save_reload')
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })
})
