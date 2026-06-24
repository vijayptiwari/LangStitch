import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 3 — cycles 31–40', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-31: shortcuts modal documents focus search', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('shortcuts-modal')).toBeVisible()
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Focus search/i)
    await expect(page.getByTestId('shortcuts-modal')).toContainText(/Ctrl.*F/i)
    await page.keyboard.press('Control+f')
    await expect(page.getByTestId('graph-name-input')).toBeFocused()
  })

  test('cycle-32: undo stack depth limit shows user notice', async ({ page }) => {
    await page.evaluate((depth) => {
      const store = (window as unknown as { __graphStore: { getState: () => {
        addNode: (n: unknown) => void
      } } }).__graphStore.getState()
      for (let i = 0; i < depth + 1; i++) {
        store.addNode({
          id: `undo-test-${i}`,
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
    await expect(page.getByTestId('undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-33: CHANGELOG entry template for cycle 33', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('**Batch N (Cycles X–Y):**')
    expect(changelog).toContain('Example (Cycle 33)')
  })

  test('cycle-34: toolbar-save is visible', async ({ page }) => {
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-35: toolbar redo disabled when graph is empty', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as { __graphStore: { getState: () => {
        nodes: { id: string; data: { kind: string } }[]
        removeNode: (id: string) => void
        resetProject: () => void
      } } }).__graphStore.getState()
      store.resetProject()
      const toRemove = store.nodes.filter(
        (n) => n.data.kind !== 'start' && n.data.kind !== 'end',
      )
      for (const n of toRemove) {
        store.removeNode(n.id)
      }
    })
    await expect(page.getByTestId('toolbar-redo')).toBeDisabled()
  })

  test('cycle-36: export retry button on Platform Export API error', async ({ page }) => {
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

  test('cycle-37: guardrail description character count', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const desc = page.locator('[data-testid^="guardrail-description-"]').last()
    const count = page.locator('[data-testid^="guardrail-description-count-"]').last()
    await desc.fill('Test guardrail description')
    await expect(count).toHaveText(/\d+\/500/)
    await expect(count).toContainText('26/500')
  })

  test('cycle-38: node duplicate via Ctrl+D on canvas', async ({ page }) => {
    await page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]').click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+d')
    await expect(page.locator('.react-flow__viewport .react-flow__node')).toHaveCount(before + 1)
  })

  test('cycle-39: export validation warning for missing eval-dataset', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as { __graphStore: { getState: () => {
        updateGraphSettings: (s: { eval: { enabled: boolean; datasetName: string; datasetId: string; experimentPrefix: string; maxConcurrency: number; description: string } }) => void
      } } }).__graphStore.getState()
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

  test('cycle-40: rate-limit friendly error message on /api/export', async ({ request }) => {
    const body = {
      project_id: 'rate-limit-test-batch3',
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
