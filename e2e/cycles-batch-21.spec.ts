import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey, VIEWPORT_STORAGE_PREFIX } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 21 — cycles 211–220', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-211: shortcuts modal documents focus search', async ({ page }) => {
    await page.keyboard.press('Control+f')
    await expect(page.getByTestId('graph-name-input')).toBeFocused()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-211-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-91-focus-search')).toBeVisible()
  })

  test('cycle-212: graph store persists viewport in localStorage', async ({ page }) => {
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
    const source = readFileSync('src/lib/viewportStorage.ts', 'utf-8')
    expect(source).toContain('cycles 68, 164, 212')
  })

  test('cycle-213: README section documents platform API', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Platform API')
    expect(readme).toContain('cycle-213')
    expect(readme).toContain('GET /api/health')
    expect(readme).toContain('POST /api/export')
    expect(readme).toContain('POST /api/eval/run')
  })

  test('cycle-214: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-214-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-215: disable toolbar platform when graph is empty', async ({ page }) => {
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
    await expect(platform).toHaveAttribute('data-cycle-empty', '215')
  })

  test('cycle-216: export retry button on Platform Export API error', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/export', async (route) => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({ status: 500, body: 'Export failed' })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/zip',
          body: Buffer.from('PK\x03\x04batch21'),
        })
      }
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('export-error')).toBeVisible({ timeout: 10_000 })
    const retry = page.getByTestId('export-retry')
    await expect(retry).toBeVisible()
    await expect(retry).toHaveAttribute('data-cycle-retry', '216')
  })

  test('cycle-217: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-cycle-count="217"]').last()
    await desc.fill('Batch 21 guardrail description')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('30/500')
  })

  test('cycle-218: canvas context menu delete node', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await expect(node).toBeVisible()
    await node.click({ button: 'right', force: true })
    await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
    await expect(page.getByTestId('cycle-218-context-delete')).toBeAttached()
    await page.getByTestId('canvas-context-delete').click()
    await expect(node).toHaveCount(0)
  })

  test('cycle-219: export validation warning for missing eval-dataset', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-219-eval-warning')).toBeAttached()
  })

  test('cycle-220: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch21',
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
    expect(source).toContain('cycle 220')
  })
})
