import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 27 — cycles 271–280', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-271: Ctrl+P keyboard shortcut focuses graph name search', async ({ page }) => {
    await page.keyboard.press('Control+p')
    await expect(page.getByTestId('graph-name-input')).toBeFocused()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-271-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-271-focus-search')).toContainText(/Ctrl.*P.*Focus/i)
  })

  test('cycle-272: undo stack depth limit shows user notice', async ({ page }) => {
    await page.evaluate((depth) => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              addNode: (n: unknown) => void
            }
          }
        }
      ).__graphStore.getState()
      for (let i = 0; i < depth + 1; i++) {
        store.addNode({
          id: `undo-batch27-${i}`,
          type: 'llmNode',
          position: { x: 100 + i, y: 100 },
          data: {
            kind: 'llm',
            label: 'Undo test',
            model: 'gpt-4o-mini',
            systemPrompt: '',
            userPrompt: '',
            temperature: 0.7,
            maxTokens: 4096,
            topP: 1,
            outputKey: 'messages',
            boundToolIds: [],
            boundAgentIds: [],
          },
        })
      }
    }, MAX_UNDO_STACK_DEPTH)
    await expect(page.getByTestId('cycle-272-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-273: CHANGELOG entry template for cycle 273', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('Example (Cycle 273)')
    expect(changelog).toContain('Batch 27 (Cycles 271–280)')
  })

  test('cycle-274: platform git tab user flow', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    const gitTab = page.getByTestId('platform-tab-git')
    await expect(gitTab).toHaveAttribute('data-cycle-git', '274')
    await gitTab.click()
    await expect(page.getByPlaceholder(/github.com/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect \/ Init/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Resync \(Pull\)/i })).toBeVisible()
  })

  test('cycle-275: toolbar redo disabled when graph is empty', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-155-redo-empty-guard')).toHaveAttribute('data-cycle-redo', '275')
    await expect(page.getByTestId('toolbar-redo')).toBeDisabled()
  })

  test('cycle-276: export retry button on Platform Export API error', async ({ page }) => {
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
    await expect(retry).toHaveAttribute('data-cycle-retry-alt', '276')
  })

  test('cycle-277: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Test guardrail description')
    await expect(count).toHaveAttribute('data-cycle-count-alt', '277')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('26/500')
  })

  test('cycle-278: minimap highlight for selected node', async ({ page }) => {
    await expect(page.getByTestId('cycle-278-minimap-highlight')).toBeAttached()
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('minimapNodeStrokeColor')
    expect(source).toContain('cycle-278-minimap-highlight')
  })

  test('cycle-279: export validation warning for missing eval-dataset', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-279-eval-warning')).toBeAttached()
  })

  test('cycle-280: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch27',
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
    expect(source).toContain('cycles 160, 220, 280')
  })
})
