import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 10 — cycles 101–110', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-101: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('eval-dry-run-badge')).toContainText(/Dry-run only/i)
  })

  test('cycle-102: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(2)
  })

  test('cycle-103: shortcuts modal documents open eval tab', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('cycle-103-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-103-open-eval-tab')).toContainText(/Open Platform Eval tab/i)
  })

  test('cycle-104: dirty flag clears after successful import', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Dirty Test Graph')
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
                navigationPath: string[]
              }
              loadProject: (p: unknown) => void
              isDirty: boolean
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      store.loadProject({
        document: { ...(payload.document as object), name: 'Imported Clean' },
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
  })

  test('cycle-105: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /docs/i)
    await expect(link).toHaveAttribute('title', /documentation/i)
  })

  test('cycle-106: toolbar-save is visible', async ({ page }) => {
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-107: toolbar redo has aria-label', async ({ page }) => {
    await expect(page.getByTestId('toolbar-redo')).toHaveAttribute('aria-label', 'Redo last reset')
  })

  test('cycle-108: collapse/expand Platform Eval section', async ({ page }) => {
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
    await page.getByTestId('eval-section-toggle').click()
    await expect(page.getByTestId('eval-dataset-name')).not.toBeVisible()
    await page.getByTestId('eval-section-toggle').click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
  })

  test('cycle-109: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const names = page.locator('[data-testid^="guardrail-name-"]')
    await names.nth(0).fill('PII Blocker')
    await names.nth(1).fill('Token Budget')
    await page.getByTestId('guardrail-search').fill('PII')
    await expect(names.nth(0)).toBeVisible()
    await expect(names.nth(1)).not.toBeVisible()
    await page.getByTestId('guardrail-search').fill('nomatch')
    await expect(page.getByTestId('guardrail-filter-empty')).toBeVisible()
  })

  test('cycle-110: node duplicate via Ctrl+D on canvas', async ({ page }) => {
    await page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]').click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+d')
    await expect(page.locator('.react-flow__viewport .react-flow__node')).toHaveCount(before + 1)
  })
})
