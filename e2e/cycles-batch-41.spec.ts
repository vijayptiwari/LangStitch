import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { MAX_UNDO_STACK_DEPTH } from '../src/lib/designerConstants'

test.describe('SDLC Batch 41 — cycles 411–420', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-411: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch41_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-manifest-alt3',
      '411',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch41_manifest_ds/)
    const source = readFileSync('src/lib/codegen/bundleGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 51, 111, 231, 291, 351, 411')
  })

  test('cycle-412: OpenAPI-style description for /api/export', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/openapi.json')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as {
      openapi?: string
      paths?: Record<string, { post?: { summary?: string; requestBody?: unknown } }>
    }
    expect(body.openapi).toMatch(/^3\./)
    expect(body.paths?.['/api/export']?.post?.summary).toMatch(/export/i)
    expect(body.paths?.['/api/export']?.post?.requestBody).toBeTruthy()
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 232, 292, 352, 412')
  })

  test('cycle-413: eval history last-413 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 420 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch41_hist_${i}`,
        datasetId: '',
        dryRun: true,
        message: 'dry-run',
      }))
      sessionStorage.setItem('langstitch-eval-history-my_langgraph', JSON.stringify(entries))
    })
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.getByTestId('toolbar-platform').click()
    const count = await page.evaluate(() => {
      const raw = sessionStorage.getItem('langstitch-eval-history-my_langgraph')
      return raw ? (JSON.parse(raw) as unknown[]).length : 0
    })
    expect(count).toBeLessThanOrEqual(413)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 413')
  })

  test('cycle-414: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch41_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live-alt3', '414')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
    await expect(live).toHaveAttribute('aria-live', 'polite')
  })

  test('cycle-415: shortcuts modal documents toggle platform', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-415-toggle-platform')).toBeVisible()
    await expect(page.getByTestId('cycle-415-toggle-platform')).toContainText(/Ctrl.*D.*Platform/i)
  })

  test('cycle-416: undo stack depth limit with user notice', async ({ page }) => {
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
          id: `undo-test-416-${i}`,
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
    await expect(page.getByTestId('cycle-416-undo-depth-notice')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('undo-depth-notice')).toContainText(/Undo history limit/i)
  })

  test('cycle-417: CHANGELOG entry template for cycle 417', async () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf-8')
    expect(changelog).toContain('## Cycle entry template')
    expect(changelog).toContain('Example (Cycle 417)')
    expect(changelog).toContain('Batch 41 (Cycles 411–420)')
  })

  test('cycle-418: open-shortcuts user flow', async ({ page }) => {
    await page.keyboard.press('?')
    const modal = page.getByTestId('shortcuts-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toHaveAttribute('data-cycle-alt', '418')
    await expect(modal).toContainText(/Keyboard shortcuts/i)
    await expect(modal).toContainText(/Save project/i)
    await page.getByTestId('cycle-78-focus-trap').getByRole('button', { name: 'Close' }).click()
    await expect(modal).toHaveCount(0)
  })

  test('cycle-419: persist toolbar redo last-used option', async ({ page }) => {
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              resetProject: () => void
            }
          }
        }
      ).__graphStore.getState()
      store.resetProject()
    })
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await page.getByTestId('toolbar-redo').click()
    const stored = await page.evaluate(() =>
      localStorage.getItem('langstitch-toolbar-redo-last-used'),
    )
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!) as { at?: string }
    expect(parsed.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const persisted = page.getByTestId('toolbar-redo-persisted')
    await expect(persisted).toHaveAttribute('data-cycle-redo-persist-alt', '419')
    await expect(persisted).toContainText(parsed.at!)
  })

  test('cycle-420: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch41-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle-copy-alt2', '420')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/Export|bundle|Git|Eval/i)
  })
})
