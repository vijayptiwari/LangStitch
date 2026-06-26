import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

test.describe('SDLC Batch 13 — cycles 131–140', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-131: toolbar redo shows cycle 131 tooltip', async ({ page }) => {
    const tooltip = page.getByTestId('cycle-131-redo-tooltip')
    await expect(tooltip).toBeAttached()
    await expect(tooltip).toContainText(/131/i)
    await expect(tooltip).toContainText(/Ctrl\+Shift\+Z/i)
    await expect(page.getByTestId('toolbar-redo')).toHaveAttribute(
      'aria-describedby',
      'toolbar-redo-tooltip-131',
    )
  })

  test('cycle-132: deploy tab shows loading skeleton', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('deploy-panel')).toBeVisible()
    await expect(page.getByTestId('cycle-132-deploy-skeleton')).toBeVisible()
    await expect(page.getByTestId('deploy-tab-skeleton')).toBeVisible()
  })

  test('cycle-133: guardrail designer empty-state hint', async ({ page }) => {
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
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await expect(page.getByTestId('cycle-133-guardrails-empty-hint')).toBeVisible()
    await expect(page.getByTestId('guardrails-empty-hint')).toContainText(/No guardrails yet/i)
  })

  test('cycle-134: minimap highlight for selected node', async ({ page }) => {
    await expect(page.getByTestId('cycle-134-minimap-highlight')).toBeAttached()
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('minimapNodeStrokeColor')
    expect(source).toContain('cycle-134-minimap-highlight')
  })

  test('cycle-135: langsmith.json export metadata includes eval-dataset', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch13_langsmith_ds' },
    }
    const json = JSON.parse(generateLangsmithJson(doc)) as {
      'eval-dataset'?: { dataset_name: string; enabled: boolean }
    }
    expect(json['eval-dataset']).toBeTruthy()
    expect(json['eval-dataset']?.enabled).toBe(true)
    expect(json['eval-dataset']?.dataset_name).toBe('batch13_langsmith_ds')
  })

  test('cycle-136: health API returns node-count', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { 'node-count'?: number }
    expect(typeof body['node-count']).toBe('number')
    expect(body['node-count']).toBeGreaterThanOrEqual(0)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('"node-count"')
  })

  test('cycle-137: eval runner shows pass-rate in result panel', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch13_pass_rate_ds')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const passRate = page.getByTestId('eval-result-pass-rate')
    await expect(passRate).toBeVisible()
    await expect(passRate).toContainText(/Pass rate:/i)
    await expect(passRate).toContainText(/100/)
  })

  test('cycle-138: modal focus trap (cycle 138 variant)', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    const trap = page.getByTestId('cycle-138-focus-trap')
    await expect(trap).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const closeFocused = await page.getByRole('button', { name: 'Close' }).evaluate(
      (el) => el === document.activeElement,
    )
    expect(closeFocused).toBe(true)
  })

  test('cycle-139: shortcuts modal documents duplicate node', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('cycle-139-duplicate-node')).toBeVisible()
    await expect(page.getByTestId('cycle-139-duplicate-node')).toContainText(/Alt.*D.*Duplicate/i)
  })

  test('cycle-140: merge imported viewport on project load', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 131, y: 140, zoom: 0.85 }),
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
    expect(viewport).toMatchObject({ x: 131, y: 140, zoom: 0.85 })
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('Merges imported viewport with localStorage')
  })
})
