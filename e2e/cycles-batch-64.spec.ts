import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 64 — cycles 641–650', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-641: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-641-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-642: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('cycles 162, 222, 282, 342, 402, 462, 522, 582, 642')
  })

  test('cycle-643: Ctrl+Shift+E opens Platform Eval tab', async ({ page }) => {
    await page.keyboard.press('Control+Shift+e')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    await expect(page.getByTestId('eval-panel')).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-643-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-643-open-eval-tab')).toContainText(/Ctrl.*Shift.*E.*Eval/i)
  })

  test('cycle-644: graph store persists viewport in localStorage', async ({ page }) => {
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
    expect(source).toContain('cycles 68, 164, 212, 260, 308, 356, 404, 452, 500, 548, 596, 644')
  })

  test('cycle-645: README section documents eval runner', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('## LangSmith Eval Runner')
    expect(readme).toContain('cycle-645')
    expect(readme).toContain('eval_runner.py')
  })

  test('cycle-646: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-646-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-647: toolbar platform has aria-label', async ({ page }) => {
    const platform = page.getByTestId('toolbar-platform')
    await expect(platform).toHaveAttribute('aria-label', 'Open Platform drawer')
    await expect(platform).toHaveAttribute('data-cycle-aria-alt3', '647')
  })

  test('cycle-648: collapse/expand Platform Eval section', async ({ page }) => {
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
    const toggle = page.getByTestId('eval-section-toggle')
    await expect(toggle).toHaveAttribute('data-cycle-collapse-alt6', '648')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('cycle-649: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    const search = page.getByTestId('guardrail-search')
    await expect(search).toHaveAttribute('data-cycle-search-alt7', '649')
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const names = page.locator('[data-testid^="guardrail-name-"]')
    await names.nth(0).fill('PII Blocker')
    await names.nth(1).fill('Token Budget')
    await search.fill('PII')
    await expect(names.nth(0)).toBeVisible()
    await expect(names.nth(1)).not.toBeVisible()
    await search.fill('nomatch')
    await expect(page.getByTestId('guardrail-filter-empty')).toBeVisible()
  })

  test('cycle-650: canvas context menu item delete', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ button: 'right', force: true })
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
    await expect(page.getByTestId('cycle-650-context-delete')).toBeAttached()
    await page.getByTestId('canvas-context-delete').click()
    await expect(node).toHaveCount(0)
  })
})
