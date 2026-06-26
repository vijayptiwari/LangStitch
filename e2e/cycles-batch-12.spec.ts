import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 12 — cycles 121–130', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-121: confirm dialog before delete in Guardrail', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Guardrails/i }).click()
    await page.getByRole('button', { name: /Add guardrail/i }).click()
    const removeBtn = page.locator('[data-testid^="guardrail-remove-"]').first()
    await expect(removeBtn).toBeVisible()
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/Delete guardrail/i)
      dialog.dismiss()
    })
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()
  })

  test('cycle-122: edge label truncation with tooltip cycle 122', async ({ page }) => {
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
      const longLabel = 'very_long_branch_label_for_truncation_test_cycle_122'
      store.setEdges([
        ...store.edges.map((e) => ({ ...e, type: 'truncated' })),
        {
          id: 'e-long-label-122',
          source: 'llm-1',
          target: 'decision-1',
          label: longLabel,
          type: 'truncated',
        },
      ] as never)
    })
    const label = page.getByTestId('edge-label-e-long-label-122')
    await expect(label).toBeVisible({ timeout: 5_000 })
    await expect(label).toHaveAttribute('title', 'very_long_branch_label_for_truncation_test_cycle_122')
    await expect(label).toContainText(/…/)
  })

  test('cycle-123: export dry-run preview shows eval-dataset', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              updateGraphSettings: (s: {
                eval: { enabled: boolean; datasetName: string; datasetId: string }
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      store.updateGraphSettings({
        eval: { enabled: true, datasetName: 'batch12_dry_run_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch12_dry_run_ds/)
  })

  test('cycle-124: CORS preflight support for /api/export', async ({ request }) => {
    const res = await request.fetch('http://127.0.0.1:8787/api/export', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(res.status()).toBeLessThan(300)
    expect(res.headers()['access-control-allow-origin']).toBeTruthy()
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('@app.options("/api/export")')
  })

  test('cycle-125: link eval dataset name in result summary', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch12_eval_dataset')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    const link = page.getByTestId('eval-result-dataset-link')
    await expect(link).toBeVisible()
    await expect(link).toHaveText('batch12_eval_dataset')
    await expect(link).toHaveAttribute('href', /batch12_eval_dataset/)
  })

  test('cycle-126: reduce-motion respect for transitions', async () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('transition-duration: 0.01ms')
  })

  test('cycle-127: Ctrl+G toggles minimap', async ({ page }) => {
    await expect(page.locator('.react-flow__minimap')).toBeVisible()
    await page.keyboard.press('Control+g')
    await expect(page.locator('.react-flow__minimap')).toHaveCount(0)
    await page.keyboard.press('Control+g')
    await expect(page.locator('.react-flow__minimap')).toBeVisible()
  })

  test('cycle-127: shortcuts modal documents Ctrl+G toggle minimap', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('cycle-127-toggle-minimap')).toBeVisible()
    await expect(page.getByTestId('cycle-127-toggle-minimap')).toContainText(/Ctrl.*G.*minimap/i)
  })

  test('cycle-128: undo stack depth limit with user notice', async ({ page }) => {
    await page.evaluate((depth) => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              addNode: (node: {
                id: string
                type: string
                position: { x: number; y: number }
                data: Record<string, unknown>
              }) => void
            }
          }
        }
      ).__graphStore.getState()
      for (let i = 0; i < depth + 1; i++) {
        store.addNode({
          id: `undo-batch12-${i}`,
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
    await expect(page.getByTestId('cycle-128-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-129: CHANGELOG entry template for cycle 129', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('**Batch N (Cycles X–Y):**')
    expect(changelog).toContain('Example (Cycle 129)')
    expect(changelog).toContain('Batch 12 (Cycles 121–130)')
  })

  test('cycle-130: save-and-reload user flow', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('batch12_save_reload')
    await page.getByTestId('toolbar-save').click()
    await expect(page.getByTestId('toolbar-saved-at')).toBeVisible({ timeout: 3_000 })
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              getProjectPayload: () => unknown
              loadProject: (payload: unknown) => void
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      localStorage.setItem('langstitch-c130-draft', JSON.stringify(payload))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.evaluate(() => {
      const raw = localStorage.getItem('langstitch-c130-draft')
      if (!raw) throw new Error('missing draft')
      const payload = JSON.parse(raw)
      ;(
        window as unknown as {
          __graphStore: { getState: () => { loadProject: (p: unknown) => void } }
        }
      ).__graphStore.getState().loadProject(payload)
    })
    await expect(page.getByTestId('graph-name-input')).toHaveValue('batch12_save_reload')
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })
})
