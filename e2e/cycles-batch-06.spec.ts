import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 6 — cycles 61–70', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-61: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toBeVisible()
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-62: minimap highlight for selected node', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    await expect(minimap).toBeVisible()
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('react-flow__minimap-node')
  })

  test('cycle-63: export dry-run preview shows eval-dataset', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch6_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch6_dry_run_ds/)
  })

  test('cycle-64: CORS preflight support for /api/export', async ({ request }) => {
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
    expect(source).toContain('@app.options("/api/export")')
  })

  test('cycle-65: link eval dataset name in result summary', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch6_eval_dataset')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toBeVisible()
    await expect(link).toHaveText('batch6_eval_dataset')
    await expect(link).toHaveAttribute('href', /batch6_eval_dataset/)
  })

  test('cycle-66: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('transition-duration: 0.01ms')
  })

  test('cycle-67: shortcuts modal documents toggle minimap', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('shortcuts-modal')).toBeVisible()
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Toggle minimap/i)
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Ctrl.*M/i)
  })

  test('cycle-68: graph store persists viewport in localStorage', async ({ page }) => {
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
  })

  test('cycle-69: README section RAG nodes', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### RAG nodes')
    expect(readme).toContain('RAG Agent node')
    expect(readme).toContain('RAG Pipelines')
  })

  test('cycle-70: E2E assertion for toolbar-save visibility', async ({ page }) => {
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
  })
})
