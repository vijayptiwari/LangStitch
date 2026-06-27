import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 46 — cycles 461–470', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-461: eval dry-run badge when API key missing', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('eval-dry-run-badge')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-461-eval-dry-run')).toBeAttached()
    await expect(page.getByTestId('cycle-161-eval-dry-run')).toContainText(/Dry-run only/i)
  })

  test('cycle-462: high-contrast focus ring on node palette', async ({ page }) => {
    const paletteItem = page.getByTestId('palette-llm')
    await paletteItem.focus()
    const outline = await paletteItem.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('cycles 162, 222, 282, 342, 402, 462')
  })

  test('cycle-463: shortcuts modal documents open eval tab', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-463-open-eval-tab')).toBeVisible()
    await expect(page.getByTestId('cycle-463-open-eval-tab')).toContainText(/Ctrl.*E.*Eval/i)
  })

  test('cycle-464: undo stack depth limit with user notice', async ({ page }) => {
    await page.evaluate((depth) => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              addNode: (n: {
                id: string
                type: string
                position: { x: number; y: number }
                data: Record<string, unknown>
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      for (let i = 0; i < depth + 2; i++) {
        store.addNode({
          id: `undo-test-464-${i}`,
          type: 'llm',
          position: { x: 100 + i * 10, y: 200 },
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
    await expect(page.getByTestId('cycle-464-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-465: CHANGELOG entry template for cycle 465', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('Example (Cycle 465)')
    expect(changelog).toContain('Batch 46 (Cycles 461–470)')
  })

  test('cycle-466: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-466-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-467: toolbar redo has aria-label', async ({ page }) => {
    const redo = page.getByTestId('toolbar-redo')
    await expect(redo).toHaveAttribute('aria-label', 'Redo last reset')
    await expect(redo).toHaveAttribute('data-cycle-redo-aria-alt', '467')
  })

  test('cycle-468: collapse/expand Platform Eval section', async ({ page }) => {
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
    await expect(toggle).toHaveAttribute('data-cycle-collapse-alt3', '468')
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).not.toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('eval-dataset-name')).toBeVisible()
  })

  test('cycle-469: guardrail search filter', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByTestId('asset-designers').getByRole('button', { name: 'Guardrails' }).click()
    const search = page.getByTestId('guardrail-search')
    await expect(search).toHaveAttribute('data-cycle-search-alt4', '469')
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const names = page.locator('[data-testid^="guardrail-name-"]')
    await names.nth(0).fill('PII Blocker')
    await names.nth(1).fill('Token Budget')
    await search.fill('PII')
    await expect(names.nth(0)).toBeVisible()
    await expect(names.nth(1)).not.toBeVisible()
    await search.fill('nomatch')
    await expect(page.getByTestId('guardrail-filter-empty')).toBeVisible()
  })

  test('cycle-470: Ctrl+D duplicates selected node on canvas', async ({ page }) => {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cycle-ctrl-d-alt3', '470')
    const node = page.locator('.react-flow__viewport .react-flow__node[data-id="llm-1"]')
    await node.click({ force: true })
    const before = await page.locator('.react-flow__viewport .react-flow__node').count()
    await page.keyboard.press('Control+d')
    const after = await page.locator('.react-flow__viewport .react-flow__node').count()
    expect(after).toBe(before + 1)
    const source = readFileSync('src/components/canvas/GraphCanvas.tsx', 'utf-8')
    expect(source).toContain('cycle 254, 326, 398, 470')
  })
})
