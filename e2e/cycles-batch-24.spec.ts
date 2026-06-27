import { readFileSync } from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'

const FIXTURE = path.join('e2e', 'fixtures', 'basic-agent.langstitch.json')

test.describe('SDLC Batch 24 — cycles 241–250', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-241: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toHaveAttribute('data-cycle-guard', '241')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-242: multi-select delete shows confirmation dialog', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-multi', '242')
    await page.keyboard.down('Shift')
    await page.locator('.react-flow__viewport .react-flow__node[data-id="fn-1"]').click({ force: true })
    await page.locator('.react-flow__viewport .react-flow__node[data-id="tool-1"]').click({ force: true })
    await page.keyboard.up('Shift')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete 2 selected nodes/)
      dialog.dismiss()
    })
    await page.keyboard.press('Delete')
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('Delete ${deletable.length} selected nodes')
  })

  test('cycle-243: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch24_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute('data-cycle-dry-run', '243')
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch24_dry_run_ds/)
  })

  test('cycle-244: CORS preflight support for /api/export', async ({ request }) => {
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
    expect(source).toContain('cycles 124, 244')
  })

  test('cycle-245: link eval dataset name in result summary', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch24_eval_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toHaveAttribute('data-cycle-link', '245')
    await expect(link).toHaveText('batch24_eval_dataset')
  })

  test('cycle-246: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('cycles 186, 246')
  })

  test('cycle-247: shortcuts modal documents toggle minimap', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-247-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-127-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-247-toggle-minimap')).toContainText(/Ctrl.*G.*minimap/i)
  })

  test('cycle-248: dirty flag clears after successful import', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __graphStore: { getState: () => { setDocumentMeta: (m: { name: string }) => void } }
        }
      ).__graphStore.getState().setDocumentMeta({ name: 'Batch24 Dirty Graph' })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toBeVisible()
    const raw = readFileSync(FIXTURE, 'utf-8')
    const afterLoad = await page.evaluate((json) => {
      const payload = JSON.parse(json) as Record<string, unknown>
      const { canvasByGraph, navigationPath, ...docFields } = payload
      const api = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              loadProject: (p: unknown) => void
              isDirty: boolean
            }
          }
        }
      ).__graphStore
      api.getState().loadProject({ document: docFields, canvasByGraph, navigationPath })
      return api.getState().isDirty
    }, raw)
    expect(afterLoad).toBe(false)
    await page.waitForFunction(() => {
      const s = (
        window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }
      ).__graphStore.getState()
      return !s.isDirty
    }, undefined, { timeout: 10_000 })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 152, 248')
  })

  test('cycle-249: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /langstitch\.com\/docs/)
    await expect(page.getByTestId('cycle-249-docs-tooltip')).toBeAttached()
  })

  test('cycle-250: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-250-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })
})
