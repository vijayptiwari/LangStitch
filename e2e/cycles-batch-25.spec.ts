import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { DEFAULT_EVAL } from '../src/lib/designerConstants'

test.describe('SDLC Batch 25 — cycles 251–260', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-251: toolbar redo shows cycle 251 tooltip marker', async ({ page }) => {
    const tooltip = page.getByTestId('cycle-131-redo-tooltip')
    await expect(tooltip).toBeAttached()
    await expect(tooltip).toHaveAttribute('data-cycle-redo', '251')
    await expect(tooltip).toContainText(/131/i)
    await expect(page.getByTestId('toolbar-redo')).toHaveAttribute(
      'aria-describedby',
      'toolbar-redo-tooltip-131',
    )
  })

  test('cycle-252: deploy tab shows loading skeleton', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('deploy-panel')).toBeVisible()
    await expect(page.getByTestId('cycle-252-deploy-skeleton')).toBeVisible()
    await expect(page.getByTestId('deploy-tab-skeleton')).toBeVisible()
  })

  test('cycle-253: guardrail designer empty-state hint', async ({ page }) => {
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
    await expect(page.getByTestId('cycle-253-guardrails-empty-hint')).toBeVisible()
    await expect(page.getByTestId('guardrails-empty-hint')).toContainText(/No guardrails yet/i)
  })

  test('cycle-254: Ctrl+D duplicates selected node on canvas', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-ctrl-d', '254')
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+d')
    const after = await page.locator('.react-flow__viewport .react-flow__node').count()
    expect(after).toBe(before + 1)
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('cycle 254')
  })

  test('cycle-255: langsmith.json export metadata includes eval-dataset', () => {
    const doc = createDefaultDocument()
    doc.settings = {
      ...doc.settings!,
      eval: { ...DEFAULT_EVAL, enabled: true, datasetName: 'batch25_langsmith_ds' },
    }
    const json = JSON.parse(generateLangsmithJson(doc)) as {
      'eval-dataset'?: { dataset_name: string; enabled: boolean }
    }
    expect(json['eval-dataset']).toBeTruthy()
    expect(json['eval-dataset']?.enabled).toBe(true)
    expect(json['eval-dataset']?.dataset_name).toBe('batch25_langsmith_ds')
    const source = readFileSync('src/lib/codegen/pythonProjectGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 75, 135, 195, 255')
  })

  test('cycle-256: health API returns node-count', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { 'node-count'?: number }
    expect(typeof body['node-count']).toBe('number')
    expect(body['node-count']).toBeGreaterThanOrEqual(0)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 76, 196, 256')
  })

  test('cycle-257: eval runner shows pass-rate in result panel', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch25_pass_rate_ds')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const passRate = page.getByTestId('eval-result-pass-rate')
    await expect(passRate).toHaveAttribute('data-cycle-pass', '257')
    await expect(passRate).toContainText(/Pass rate:/i)
    await expect(passRate).toContainText(/100/)
  })

  test('cycle-258: modal focus trap (cycle 258 variant)', async ({ page }) => {
    await page.keyboard.press('?')
    const trap = page.getByTestId('cycle-258-focus-trap')
    await expect(trap).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const closeFocused = await page
      .getByTestId('cycle-78-focus-trap')
      .getByRole('button', { name: 'Close' })
      .evaluate((el) => el === document.activeElement)
    expect(closeFocused).toBe(true)
  })

  test('cycle-259: Alt+E duplicates selected node', async ({ page }) => {
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Alt+e')
    const after = await page.locator('.react-flow__viewport .react-flow__node').count()
    expect(after).toBe(before + 1)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-259-duplicate-node')).toBeVisible()
    await expect(page.getByTestId('cycle-259-duplicate-node')).toContainText(/Alt.*E.*Duplicate/i)
  })

  test('cycle-260: graph store persists viewport in localStorage', async ({ page }) => {
    const viewport = await page.evaluate(() => {
      localStorage.setItem(
        'langstitch-viewport-my_langgraph',
        JSON.stringify({ x: 251, y: 260, zoom: 0.9 }),
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
    expect(viewport).toMatchObject({ x: 251, y: 260, zoom: 0.9 })
    const source = readFileSync('src/lib/viewportStorage.ts', 'utf-8')
    expect(source).toContain('cycles 68, 164, 212, 260')
  })
})
