import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 69 — cycles 691–700', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-691: Alt+P focuses node palette search', async ({ page }) => {
    const search = page.getByTestId('palette-search-input')
    await expect(search).toBeVisible()
    await page.keyboard.press('Alt+p')
    await expect(search).toBeFocused()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-691-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-691-focus-search')).toContainText(/Alt.*P/i)
  })

  test('cycle-692: graph store persists viewport in localStorage', async ({ page }) => {
    const projectName = await page.evaluate(() =>
      (
        window as unknown as {
          __graphStore: { getState: () => { document: { name: string } } }
        }
      ).__graphStore.getState().document.name,
    )
    const key = viewportStorageKey(projectName)
    expect(key.startsWith(VIEWPORT_STORAGE_PREFIX)).toBe(true)
    await page.locator('.react-flow__controls button').first().click()
    await page.waitForTimeout(400)
    const stored = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as { x: number; y: number; zoom: number }
    expect(typeof parsed.zoom).toBe('number')
    const source = readFileSync('src/lib/viewportStorage.ts', 'utf-8')
    expect(source).toContain('cycles 68, 164, 212, 260, 308, 356, 404, 452, 500, 548, 596, 644, 692')
  })

  test('cycle-693: README documents platform API section', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Platform API')
    expect(readme).toContain('cycle-693')
    expect(readme).toMatch(/POST.*\/api\/export|Platform API/i)
  })

  test('cycle-694: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-694-health-reload')).toBeAttached()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
  })

  test('cycle-695: toolbar platform disabled when graph is empty', async ({ page }) => {
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
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute('data-cycle-empty-alt4', '695')
  })

  test('cycle-696: export retry button on Platform Export API error', async ({ page }) => {
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
    const retry = page.getByTestId('export-retry')
    await expect(retry).toHaveAttribute('data-cycle-retry-alt8', '696')
  })

  test('cycle-697: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Batch 69 guardrail description')
    await expect(count).toHaveAttribute('data-cycle-count-alt8', '697')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('30/500')
  })

  test('cycle-698: edge label truncation with tooltip', async ({ page }) => {
    const longLabel = 'very_long_branch_label_for_truncation_test_cycle_698'
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
          id: 'e-long-label-698',
          source: 'llm-1',
          target: 'decision-1',
          label,
          type: 'truncated',
        },
      ] as never)
    }, longLabel)
    const label = page.getByTestId('edge-label-e-long-label-698')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('data-cycle-truncate-alt6', '698')
    await expect(label).toHaveAttribute('title', longLabel)
    await expect(label).toContainText(/…/)
  })

  test('cycle-699: export validation warning for missing eval-dataset', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-699-eval-warning')).toBeAttached()
  })

  test('cycle-700: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch69',
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
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 160, 220, 280, 340, 400, 460, 520, 580, 640, 700')
  })
})
