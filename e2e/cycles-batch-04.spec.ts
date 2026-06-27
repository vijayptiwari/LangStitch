import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 4 — cycles 41–50', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-41: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('eval-dry-run-badge')).toContainText(/Dry-run only/i)
  })

  test('cycle-42: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(2)
  })

  test('cycle-43: Alt+K opens Platform Eval tab', async ({ page }) => {
    await page.keyboard.press('Alt+k')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await expect(page.getByTestId('eval-panel')).toBeVisible()
  })

  test('cycle-44: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 120, y: 80, zoom: 0.75 }),
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
      store.loadProject({
        document: payload.document,
        canvasByGraph: {
          main: { nodes: payload.nodes, edges: payload.edges },
        },
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
    expect(viewport).toMatchObject({ x: 120, y: 80, zoom: 0.75 })
  })

  test('cycle-45: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('Merges imported viewport with localStorage')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
    expect(source).toContain('/** Persist pan/zoom for the active subgraph (also writes localStorage). */')
  })

  test('cycle-46: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
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

  test('cycle-47: toolbar platform has aria-label', async ({ page }) => {
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute(
      'aria-label',
      'Open Platform drawer',
    )
  })

  test('cycle-48: collapse/expand Platform Eval section', async ({ page }) => {
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

  test('cycle-49: guardrail search filter', async ({ page }) => {
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

  test('cycle-50: edge label truncation with tooltip', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              setEdges: (edges: { id: string; source: string; target: string; label: string; type: string }[]) => void
              edges: { id: string }[]
            }
          }
        }
      ).__graphStore.getState()
      const longLabel = 'very_long_branch_label_for_truncation_test_cycle_50'
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label',
          source: 'llm-1',
          target: 'decision-1',
          label: longLabel,
          type: 'truncated',
        },
      ] as never)
    })
    const label = page.getByTestId('edge-label-e-long-label')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('title', 'very_long_branch_label_for_truncation_test_cycle_50')
    await expect(label).toContainText(/…/)
  })
})
