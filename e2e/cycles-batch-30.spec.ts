import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 30 — cycles 301–310', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-301: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toHaveAttribute('data-cycle-guard-alt', '301')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-302: snap-to-grid toggle for canvas nodes', async ({ page }) => {
    const toggle = page.getByTestId('canvas-snap-toggle')
    await expect(toggle).toHaveAttribute('data-cycle-snap-alt', '302')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('cycle-303: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch30_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-dry-run-alt',
      '303',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch30_dry_run_ds/)
  })

  test('cycle-304: CORS preflight support for /api/export', async ({ request }) => {
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
    expect(source).toContain('cycles 124, 244, 304')
  })

  test('cycle-305: link eval dataset name in result summary', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch30_eval_dataset', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toHaveAttribute('data-cycle-link-alt', '305')
    await expect(link).toHaveText('batch30_eval_dataset')
  })

  test('cycle-306: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('cycles 186, 246, 306')
  })

  test('cycle-307: Ctrl+K toggles minimap', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    await page.keyboard.press('Control+k')
    await expect(minimap).toHaveCount(0)
    await page.keyboard.press('Control+k')
    await expect(minimap).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-307-toggle-minimap')).toBeVisible()
  })

  test('cycle-308: graph store persists viewport in localStorage', async ({ page }) => {
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
    const source = readFileSync('src/lib/viewportStorage.ts', 'utf-8')
    expect(source).toContain('cycles 68, 164, 212, 260, 308')
  })

  test('cycle-309: README section RAG nodes', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### RAG nodes <!-- cycle-309 -->')
    expect(readme).toContain('RAG Agent node')
    expect(readme).toContain('RAG Pipelines')
  })

  test('cycle-310: save-and-reload user flow', async ({ page }) => {
    await expect(page.getByTestId('cycle-310-save-reload')).toBeVisible()
    await page.getByTestId('graph-name-input').fill('batch30_save_reload')
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
      localStorage.setItem('langstitch-c310-draft', JSON.stringify(payload))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.evaluate(() => {
      const raw = localStorage.getItem('langstitch-c310-draft')
      if (!raw) throw new Error('missing draft')
      const payload = JSON.parse(raw)
      ;(
        window as unknown as {
          __graphStore: { getState: () => { loadProject: (p: unknown) => void } }
        }
      ).__graphStore.getState().loadProject(payload)
    })
    await expect(page.getByTestId('graph-name-input')).toHaveValue('batch30_save_reload')
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })
})
