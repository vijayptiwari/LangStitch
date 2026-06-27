import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 40 — cycles 401–410', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-401: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-401-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-402: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('cycles 162, 222, 282, 342, 402')
  })

  test('cycle-403: Alt+Shift+L opens Platform Eval tab', async ({ page }) => {
    await page.keyboard.press('Alt+Shift+l')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    await expect(page.getByTestId('eval-panel')).toBeVisible()
    await page.getByTestId('platform-drawer').getByRole('button', { name: 'Close' }).click()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-403-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-403-open-eval-tab')).toContainText(/Alt.*Shift.*L.*Eval/i)
  })

  test('cycle-404: graph store persists viewport in localStorage', async ({ page }) => {
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
    expect(source).toContain('cycles 68, 164, 212, 260, 308, 356, 404')
  })

  test('cycle-405: README section documents eval runner', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('## LangSmith Eval Runner')
    expect(readme).toContain('cycle-405')
    expect(readme).toContain('eval_runner.py')
  })

  test('cycle-406: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-406-health-reload')).toBeAttached()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { build_time?: string; version?: string }
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.version).toBeTruthy()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
  })

  test('cycle-407: toolbar platform has aria-label', async ({ page }) => {
    const platform = page.getByTestId('toolbar-platform')
    await expect(platform).toHaveAttribute('aria-label', 'Open Platform drawer')
    await expect(platform).toHaveAttribute('data-cycle-aria-alt', '407')
  })

  test('cycle-408: collapse/expand Platform Eval section', async ({ page }) => {
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
    await expect(toggle).toHaveAttribute('data-cycle-collapse-alt2', '408')
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).not.toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
  })

  test('cycle-409: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    const search = page.getByTestId('guardrail-search')
    await expect(search).toHaveAttribute('data-cycle-search-alt3', '409')
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

  test('cycle-410: edge label truncation with tooltip', async ({ page }) => {
    const longLabel = 'very_long_branch_label_for_truncation_test_cycle_410'
    await page.evaluate((label) => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              setEdges: (
                edges: { id: string; source: string; target: string; label: string; type: string }[],
              ) => void
              edges: { id: string }[]
            }
          }
        }
      ).__graphStore.getState()
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label-410',
          source: 'llm-1',
          target: 'decision-1',
          label,
          type: 'truncated',
        },
      ] as never)
    }, longLabel)
    const label = page.getByTestId('edge-label-e-long-label-410')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('data-cycle-truncate-alt2', '410')
    await expect(label).toHaveAttribute('title', longLabel)
    await expect(label).toContainText(/…/)
  })
})
