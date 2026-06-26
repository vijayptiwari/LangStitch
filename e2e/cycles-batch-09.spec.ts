import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 9 — cycles 91–100', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-91: keyboard shortcut focuses graph name search', async ({ page }) => {
    await page.keyboard.press('Control+f')
    await expect(page.getByTestId('graph-name-input')).toBeFocused()
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('cycle-91-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-91-focus-search')).toContainText(/Focus search/i)
  })

  test('cycle-92: merge imported viewport on project load', async ({ page }) => {
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

  test('cycle-93: inline JSDoc on graphStore public API', async () => {
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycle 93 JSDoc')
    expect(source).toContain('Load a project from disk or import.')
    expect(source).toContain('Merges imported viewport with localStorage')
    expect(source).toContain('/** Serialize document, canvas snapshots, and navigation for save/export. */')
    expect(source).toContain('/** Persist pan/zoom for the active subgraph (also writes localStorage). */')
  })

  test('cycle-94: platform git tab user flow', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.getByTestId('platform-tab-git').click()
    await expect(page.getByPlaceholder(/github.com/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect \/ Init/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Resync \(Pull\)/i })).toBeVisible()
  })

  test('cycle-95: toolbar platform disabled when graph is empty', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              nodes: { id: string; data: { kind: string } }[]
              removeNode: (id: string) => void
              resetProject: () => void
            }
          }
        }
      ).__graphStore.getState()
      store.resetProject()
      const toRemove = store.nodes.filter(
        (n) => n.data.kind !== 'start' && n.data.kind !== 'end',
      )
      for (const n of toRemove) {
        store.removeNode(n.id)
      }
    })
    await expect(page.getByTestId('toolbar-platform')).toBeDisabled()
  })

  test('cycle-96: export retry button on Platform Export API error', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/export', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({ status: 500, body: 'Export failed' })
      } else {
        await route.continue()
      }
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('export-error')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('export-retry')).toBeVisible()
  })

  test('cycle-97: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Batch 9 guardrail description')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('29/500')
  })

  test('cycle-98: multi-select delete shows confirmation dialog', async ({ page }) => {
    await page.keyboard.down('Shift')
    await page.locator('.react-flow__viewport .react-flow__node[data-id="fn-1"]').click({ force: true })
    await page.locator('.react-flow__viewport .react-flow__node[data-id="tool-1"]').click({ force: true })
    await page.keyboard.up('Shift')
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete 2 selected nodes/)
      dialog.dismiss()
    })
    await page.keyboard.press('Delete')
  })

  test('cycle-99: export validation warning for missing eval-dataset', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              updateGraphSettings: (s: {
                eval: {
                  enabled: boolean
                  datasetName: string
                  datasetId: string
                  experimentPrefix: string
                  maxConcurrency: number
                  description: string
                }
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      store.updateGraphSettings({
        eval: {
          enabled: true,
          datasetName: '',
          datasetId: '',
          experimentPrefix: '',
          maxConcurrency: 2,
          description: '',
        },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await expect(page.getByTestId('export-eval-dataset-warning')).toBeVisible()
    await expect(page.getByTestId('export-eval-dataset-warning')).toContainText(/eval-dataset/i)
  })

  test('cycle-100: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch9',
      format: 'python',
      files: { 'langstitch.project.json': '{}' },
    }
    for (let i = 0; i < 5; i++) {
      const res = await request.post('http://127.0.0.1:8787/api/export', { data: body })
      expect(res.status()).toBe(200)
    }
    const limited = await request.post('http://127.0.0.1:8787/api/export', { data: body })
    expect(limited.status()).toBe(429)
    const json = (await limited.json()) as { detail: string }
    expect(json.detail).toMatch(/Too many export requests/i)
  })
})
