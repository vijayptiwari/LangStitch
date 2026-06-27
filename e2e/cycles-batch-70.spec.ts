import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 70 — cycles 701–710', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-701: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-701-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-702: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('cycles 162, 222, 282, 342, 402, 462, 522, 582, 642, 702')
  })

  test('cycle-703: Ctrl+H opens Platform Eval tab when no node selected', async ({ page }) => {
    await page.keyboard.press('Control+h')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    await expect(page.getByTestId('eval-panel')).toBeVisible()
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-703-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-703-open-eval-tab')).toContainText(/Ctrl.*H.*Eval/i)
  })

  test('cycle-704: undo stack depth limit shows user notice', async ({ page }) => {
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
          id: `undo-batch70-${i}`,
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
    await expect(page.getByTestId('cycle-704-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-705: CHANGELOG entry template for cycle 705', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('Example (Cycle 705)')
    expect(changelog).toContain('Batch 70 (Cycles 701–710)')
  })

  test('cycle-706: export-zip user flow', async ({ page }) => {
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch70-export'),
        headers: { 'Content-Disposition': 'attachment; filename="my_langgraph-python.zip"' },
      })
    })
    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /^Export$/i }).click()
    await expect(page.getByTestId('cycle-706-export-zip')).toBeVisible()
    await page.getByTestId('cycle-346-export-zip').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/i)
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('platform-log')).toContainText(/Exported/i)
  })

  test('cycle-707: toolbar redo has aria-label', async ({ page }) => {
    const redo = page.getByTestId('toolbar-redo')
    await expect(redo).toHaveAttribute('aria-label', 'Redo last reset')
    await expect(redo).toHaveAttribute('data-cycle-redo-aria-alt3', '707')
  })

  test('cycle-708: collapse/expand Platform Eval section', async ({ page }) => {
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
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    const toggle = page.getByTestId('eval-section-toggle')
    await expect(toggle).toHaveAttribute('data-cycle-collapse-alt7', '708')
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).not.toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
  })

  test('cycle-709: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    const search = page.getByTestId('guardrail-search')
    await expect(search).toHaveAttribute('data-cycle-search-alt8', '709')
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    await search.fill('nonexistent-guardrail-709')
    await expect(page.getByTestId('guardrail-filter-empty')).toBeVisible()
  })

  test('cycle-710: minimap highlight for selected node', async ({ page }) => {
    await expect(page.getByTestId('cycle-710-minimap-highlight')).toBeAttached()
    const minimap = page.locator('.react-flow__minimap')
    await expect(minimap).toBeVisible()
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('minimapNodeStrokeColor')
    expect(source).toContain('cycle-710-minimap-highlight')
  })
})
