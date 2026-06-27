import { readFileSync } from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

const FIXTURE = path.join('e2e', 'fixtures', 'basic-agent.langstitch.json')

test.describe('SDLC Batch 19 — cycles 191–200', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-191: toolbar platform button tooltip', async ({ page }) => {
    const tooltip = page.getByTestId('toolbar-platform-tooltip')
    await expect(tooltip).toBeAttached()
    await expect(tooltip).toContainText(/Platform/i)
    await expect(tooltip).toContainText(/Ctrl\+E/i)
    await expect(page.getByTestId('cycle-191-platform-tooltip')).toBeAttached()
    await expect(page.getByTestId('toolbar-platform')).toHaveAttribute(
      'aria-describedby',
      'toolbar-platform-tooltip',
    )
  })

  test('cycle-192: deploy tab shows loading skeleton', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('deploy-panel')).toBeVisible()
    await expect(page.getByTestId('deploy-tab-skeleton')).toBeVisible()
  })

  test('cycle-193: guardrail designer empty-state hint', async ({ page }) => {
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
    await expect(page.getByTestId('guardrails-empty-hint')).toBeVisible()
    await expect(page.getByTestId('guardrails-empty-hint')).toContainText(/No guardrails yet/i)
  })

  test('cycle-194: edge label truncation with tooltip', async ({ page }) => {
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
      const longLabel = 'very_long_branch_label_for_truncation_test_cycle_194'
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label-194',
          source: 'llm-1',
          target: 'decision-1',
          label: longLabel,
          type: 'truncated',
        },
      ] as never)
    })
    const label = page.getByTestId('edge-label-e-long-label-194')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('title', 'very_long_branch_label_for_truncation_test_cycle_194')
    await expect(label).toContainText(/…/)
  })

  test('cycle-195: langsmith.json export metadata includes eval-dataset', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch19_langsmith_ds' },
    }
    const json = JSON.parse(generateLangsmithJson(doc)) as {
      'eval-dataset'?: { dataset_name: string; enabled: boolean }
    }
    expect(json['eval-dataset']).toBeTruthy()
    expect(json['eval-dataset']?.enabled).toBe(true)
    expect(json['eval-dataset']?.dataset_name).toBe('batch19_langsmith_ds')
  })

  test('cycle-196: health API returns node-count', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { 'node-count'?: number }
    expect(typeof body['node-count']).toBe('number')
    expect(body['node-count']).toBeGreaterThanOrEqual(0)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('"node-count"')
  })

  test('cycle-197: eval runner shows pass-rate in result panel', async ({ page }) => {
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
                eval: { enabled: boolean; datasetName: string; datasetId: string }
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
        eval: { enabled: true, datasetName: 'batch19_pass_rate_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const passRate = page.getByTestId('eval-result-pass-rate')
    await expect(passRate).toBeVisible()
    await expect(passRate).toContainText(/Pass rate:/i)
    await expect(passRate).toContainText(/100/)
  })

  test('cycle-198: modal focus trap', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    const trap = page.getByTestId('cycle-198-focus-trap')
    await expect(trap).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const closeFocused = await page
      .getByTestId('cycle-78-focus-trap')
      .getByRole('button', { name: 'Close' })
      .evaluate((el) => el === document.activeElement)
    expect(closeFocused).toBe(true)
  })

  test('cycle-199: Ctrl+H duplicates selected node', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+h')
    const after = await page.locator('.react-flow__viewport .react-flow__node').count()
    expect(after).toBe(before + 1)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-199-duplicate-node')).toBeVisible()
  })

  test('cycle-200: dirty flag clears after successful import', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __graphStore: { getState: () => { setDocumentMeta: (m: { name: string }) => void } }
        }
      ).__graphStore.getState().setDocumentMeta({ name: 'Batch19 Dirty Graph' })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toBeVisible()
    const raw = readFileSync(FIXTURE, 'utf-8')
    const afterLoad = await page.evaluate((json) => {
      const payload = JSON.parse(json) as Record<string, unknown>
      const { canvasByGraph, navigationPath, ...docFields } = payload
      const api = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              loadProject: (p: unknown) => void
              isDirty: boolean
            }
          }
        }
      ).__graphStore
      api.getState().loadProject({ document: docFields, canvasByGraph, navigationPath })
      return api.getState().isDirty
    }, raw)
    expect(afterLoad).toBe(false)
    await page.waitForFunction(() => {
      const s = (
        window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }
      ).__graphStore.getState()
      return !s.isDirty
    }, undefined, { timeout: 10_000 })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
  })
})
