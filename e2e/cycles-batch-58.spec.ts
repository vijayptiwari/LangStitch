import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 58 — cycles 581–590', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-581: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-581-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-582: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('cycles 162, 222, 282, 342, 402, 462, 522, 582')
  })

  test('cycle-583: shortcuts modal documents open eval tab', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-583-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-583-open-eval-tab')).toContainText(
      /Alt.*Shift.*D.*Eval/i,
    )
  })

  test('cycle-584: dirty flag clears after successful import', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Dirty Batch 58 Graph')
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
    expect(source).toContain('cycles 152, 248, 296, 344, 392, 440, 488, 536, 584')
  })

  test('cycle-585: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /docs/i)
    await expect(page.getByTestId('cycle-585-docs-tooltip')).toBeAttached()
  })

  test('cycle-586: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-586-health-reload')).toBeAttached()
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

  test('cycle-587: toolbar redo has aria-label', async ({ page }) => {
    const redo = page.getByTestId('toolbar-redo')
    await expect(redo).toHaveAttribute('aria-label', 'Redo last reset')
    await expect(redo).toHaveAttribute('data-cycle-redo-aria-alt2', '587')
  })

  test('cycle-588: collapse/expand Platform Eval section', async ({ page }) => {
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
    await expect(toggle).toHaveAttribute('data-cycle-collapse-alt5', '588')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('cycle-589: guardrail search/filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    const search = page.getByTestId('guardrail-search')
    await expect(search).toHaveAttribute('data-cycle-search-alt6', '589')
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

  test('cycle-590: snap-to-grid toggle for canvas nodes', async ({ page }) => {
    const toggle = page.getByTestId('canvas-snap-toggle')
    await expect(toggle).toHaveAttribute('data-cycle-snap-alt5', '590')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
