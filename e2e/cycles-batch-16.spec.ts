import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 16 — cycles 161–170', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-161: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-162: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('outline: 3px solid var(--accent)')
  })

  test('cycle-163: Ctrl+D opens Platform Eval tab when no node selected', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __graphStore: { getState: () => { selectNode: (id: string | null) => void } }
        }
      ).__graphStore.getState().selectNode(null)
    })
    await page.keyboard.press('Control+d')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    await expect(page.getByTestId('eval-panel')).toBeVisible()
    await page.getByTestId('platform-drawer').getByRole('button', { name: 'Close' }).click()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-163-open-eval-tab')).toBeVisible()
  })

  test('cycle-164: graph store persists viewport in localStorage', async ({ page }) => {
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
    expect(source).toContain('cycles 68, 164')
  })

  test('cycle-165: README section documents eval runner', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('## LangSmith Eval Runner')
    expect(readme).toContain('cycle-165')
    expect(readme).toContain('eval_runner.py')
    expect(readme).toContain('Ctrl+D')
  })

  test('cycle-166: export-zip user flow', async ({ page }) => {
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch16-export'),
        headers: { 'Content-Disposition': 'attachment; filename="my_langgraph-python.zip"' },
      })
    })
    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/i)
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('platform-log')).toContainText(/Exported/i)
  })

  test('cycle-167: toolbar platform has aria-label', async ({ page }) => {
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute(
      'aria-label',
      'Open Platform drawer',
    )
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute('data-cycle', '167')
  })

  test('cycle-168: collapse/expand Platform Eval section', async ({ page }) => {
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
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
    await expect(page.getByTestId('eval-section-toggle')).toHaveAttribute('data-cycle', '168')
    await page.getByTestId('eval-section-toggle').click()
    await expect(page.getByTestId('eval-dataset-name')).not.toBeVisible()
    await page.getByTestId('eval-section-toggle').click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
  })

  test('cycle-169: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const names = page.locator('[data-testid^="guardrail-name-"]')
    await names.nth(0).fill('PII Blocker')
    await names.nth(1).fill('Token Budget')
    await expect(page.getByTestId('guardrail-search')).toHaveAttribute('data-cycle', '169')
    await page.getByTestId('guardrail-search').fill('PII')
    await expect(names.nth(0)).toBeVisible()
    await expect(names.nth(1)).not.toBeVisible()
    await page.getByTestId('guardrail-search').fill('nomatch')
    await expect(page.getByTestId('guardrail-filter-empty')).toBeVisible()
  })

  test('cycle-170: multi-select delete shows confirmation dialog', async ({ page }) => {
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
})
