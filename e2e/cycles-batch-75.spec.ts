import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 75 — cycles 751–760', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-751: shortcuts modal documents focus search', async ({ page }) => {
    await page.keyboard.press('Control+Shift+f')
    const input = page.getByTestId('graph-name-input')
    await expect(input).toBeFocused()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-751-focus-search')).toBeVisible()
    await expect(page.getByTestId('cycle-751-focus-search')).toContainText(/Ctrl.*Shift.*F/i)
  })

  test('cycle-752: undo stack depth limit shows user notice', async ({ page }) => {
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
          id: `undo-batch75-${i}`,
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
    await expect(page.getByTestId('cycle-752-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-753: CHANGELOG entry template for cycle 753', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('Example (Cycle 753)')
    expect(changelog).toContain('Batch 75 (Cycles 751–760)')
  })

  test('cycle-754: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-754-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-755: toolbar redo disabled when graph is empty', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-155-redo-empty-guard')).toHaveAttribute(
      'data-cycle-redo-empty-alt4',
      '755',
    )
    await expect(page.getByTestId('toolbar-redo')).toBeDisabled()
  })

  test('cycle-756: export retry button on Platform Export API error', async ({ page }) => {
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
    await expect(retry).toHaveAttribute('data-cycle-retry-alt9', '756')
  })

  test('cycle-757: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Batch 75 guardrail description')
    await expect(count).toHaveAttribute('data-cycle-count-alt9', '757')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('30/500')
  })

  test('cycle-758: Ctrl+D duplicates selected node on canvas', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-ctrl-d-alt7', '758')
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+d')
    const after = await page.locator('.react-flow__viewport .react-flow__node').count()
    expect(after).toBe(before + 1)
  })

  test('cycle-759: export validation warning for missing eval-dataset', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-759-eval-warning')).toBeAttached()
  })

  test('cycle-760: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch75',
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
    expect(source).toContain('cycles 160, 220, 280, 340, 400, 460, 520, 580, 640, 700, 760')
  })
})
