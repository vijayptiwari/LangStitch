import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 45 — cycles 451–460', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-451: shortcuts modal documents focus search', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-451-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-451-focus-search')).toContainText(/Ctrl.*Shift.*H.*search/i)
  })

  test('cycle-452: graph store persists viewport in localStorage', async ({ page }) => {
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
    expect(source).toContain('cycles 68, 164, 212, 260, 308, 356, 404, 452')
  })

  test('cycle-453: README section documents platform API', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Platform API')
    expect(readme).toContain('cycle-453')
    expect(readme).toContain('GET /api/health')
    expect(readme).toContain('POST /api/export')
    expect(readme).toContain('POST /api/eval/run')
  })

  test('cycle-454: platform git tab user flow', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    const gitTab = page.getByTestId('platform-tab-git')
    await expect(gitTab).toHaveAttribute('data-cycle-git', '274')
    await expect(gitTab).toHaveAttribute('data-cycle-git-alt', '454')
    await gitTab.click()
    await expect(gitTab).toHaveClass(/active/)
    await expect(page.getByRole('button', { name: /Resync \(Pull\)/i })).toBeVisible()
  })

  test('cycle-455: disable toolbar platform when graph is empty', async ({ page }) => {
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
    const platform = page.getByTestId('toolbar-platform')
    await expect(platform).toBeDisabled()
    await expect(platform).toHaveAttribute('data-cycle-empty-alt2', '455')
  })

  test('cycle-456: export retry button on Platform Export API error', async ({ page }) => {
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
    await expect(retry).toBeVisible()
    await expect(retry).toHaveAttribute('data-cycle-retry-alt4', '456')
  })

  test('cycle-457: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Batch 45 guardrail description')
    await expect(count).toHaveAttribute('data-cycle-count-alt4', '457')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('30/500')
  })

  test('cycle-458: multi-select delete shows confirmation dialog', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-multi-alt3', '458')
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
    expect(source).toContain('data-cycle-multi-alt3="458"')
  })

  test('cycle-459: export validation warning for missing eval-dataset', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-459-eval-warning')).toBeAttached()
  })

  test('cycle-460: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch45',
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
    expect(source).toContain('cycles 160, 220, 280, 340, 400, 460')
  })
})
