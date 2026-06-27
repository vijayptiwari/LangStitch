import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { DEFAULT_EVAL, MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 55 — cycles 551–560', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-551: toolbar platform button tooltip', async ({ page }) => {
    const tooltip = page.getByTestId('toolbar-platform-tooltip')
    await expect(tooltip).toBeAttached()
    await expect(tooltip).toContainText(/Platform/i)
    await expect(tooltip).toContainText(/Ctrl\+E/i)
    const marker = page.getByTestId('cycle-551-platform-tooltip')
    await expect(marker).toHaveAttribute('data-cycle-platform-alt2', '551')
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute(
      'aria-describedby',
      'toolbar-platform-tooltip',
    )
  })

  test('cycle-552: deploy tab shows loading skeleton', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('deploy-panel')).toBeVisible()
    await expect(page.getByTestId('cycle-552-deploy-skeleton')).toBeAttached()
    await expect(page.getByTestId('deploy-tab-skeleton')).toBeVisible()
  })

  test('cycle-553: guardrail designer empty-state hint', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              document: { guardrailRegistry?: { id: string }[] }
              removeGuardrailDefinition: (id: string) => void
            }
          }
        }
      ).__graphStore.getState()
      for (const g of [...(store.document.guardrailRegistry ?? [])]) {
        store.removeGuardrailDefinition(g.id)
      }
    })
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    await expect(page.getByTestId('cycle-553-guardrails-empty-hint')).toBeVisible()
    await expect(page.getByTestId('guardrails-empty-hint')).toContainText(/No guardrails yet/i)
  })

  test('cycle-554: edge label truncation with tooltip', async ({ page }) => {
    await page.evaluate(() => {
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
      const longLabel = 'very_long_branch_label_for_truncation_test_cycle_554'
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label-554',
          source: 'llm-1',
          target: 'decision-1',
          label: longLabel,
          type: 'truncated',
        },
      ] as never)
    })
    const label = page.getByTestId('edge-label-e-long-label-554')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('data-cycle-truncate-alt4', '554')
    await expect(label).toHaveAttribute('title', 'very_long_branch_label_for_truncation_test_cycle_554')
    await expect(label).toContainText(/…/)
  })

  test('cycle-555: langsmith.json export metadata includes eval-dataset', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch55_langsmith_ds' },
    }
    const json = JSON.parse(generateLangsmithJson(doc)) as {
      'eval-dataset'?: { dataset_name: string; enabled: boolean }
    }
    expect(json['eval-dataset']).toBeTruthy()
    expect(json['eval-dataset']?.enabled).toBe(true)
    expect(json['eval-dataset']?.dataset_name).toBe('batch55_langsmith_ds')
    const source = readFileSync('src/lib/codegen/pythonProjectGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 75, 135, 195, 255, 315, 375, 411, 435, 495, 555')
  })

  test('cycle-556: health API returns node-count', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { 'node-count'?: number }
    expect(typeof body['node-count']).toBe('number')
    expect(body['node-count']).toBeGreaterThanOrEqual(0)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 76, 196, 256, 316, 376, 436, 496, 556')
  })

  test('cycle-557: eval runner shows pass-rate in result panel', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch55_pass_rate_ds')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const passRate = page.getByTestId('eval-result-pass-rate')
    await expect(passRate).toHaveAttribute('data-cycle-pass-alt5', '557')
    await expect(passRate).toContainText(/Pass rate:/i)
    await expect(passRate).toContainText(/100/)
  })

  test('cycle-558: modal focus trap', async ({ page }) => {
    await page.keyboard.press('?')
    const trap = page.getByTestId('cycle-558-focus-trap')
    await expect(trap).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const closeFocused = await page
      .getByTestId('cycle-78-focus-trap')
      .getByRole('button', { name: 'Close' })
      .evaluate((el) => el === document.activeElement)
    expect(closeFocused).toBe(true)
  })

  test('cycle-559: shortcuts modal documents duplicate node', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-559-duplicate-node')).toBeVisible()
    await expect(page.getByTestId('cycle-559-duplicate-node')).toContainText(/Ctrl.*K.*Duplicate/i)
  })

  test('cycle-560: undo stack depth limit shows user notice', async ({ page }) => {
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
          id: `undo-batch55-${i}`,
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
    await expect(page.getByTestId('cycle-560-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })
})
