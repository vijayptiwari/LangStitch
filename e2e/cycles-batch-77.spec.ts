import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 77 — cycles 771–780', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-771: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch77_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-manifest-alt9',
      '771',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch77_manifest_ds/)
    const source = readFileSync('src/lib/codegen/bundleGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 51, 111, 231, 291, 351, 411, 471, 531, 591, 651, 711, 771')
  })

  test('cycle-772: OpenAPI-style description for /api/export', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/openapi.json')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as {
      openapi?: string
      paths?: Record<string, { post?: { summary?: string } }>
    }
    expect(body.openapi).toMatch(/^3\./)
    expect(body.paths?.['/api/export']?.post?.summary).toMatch(/export/i)
    const source = readFileSync('server/main.py', 'utf-8')
    expect(source).toContain('cycles 232, 292, 352, 412, 472, 532, 592, 652, 712, 772')
  })

  test('cycle-773: eval history last-773 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 780 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch77_hist_${i}`,
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
    expect(count).toBeLessThanOrEqual(773)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 773')
  })

  test('cycle-774: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch77_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live-alt9', '774')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
  })

  test('cycle-775: Ctrl+Shift+O toggles Platform drawer', async ({ page }) => {
    await page.keyboard.press('Control+Shift+o')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Control+Shift+o')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-775-toggle-platform')).toBeVisible()
    await expect(page.getByTestId('cycle-775-toggle-platform')).toContainText(/Ctrl.*Shift.*O/i)
  })

  test('cycle-776: dirty flag clears after successful import', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Dirty Batch 77 Graph')
    await expect(page.getByTestId('graph-dirty-indicator')).toBeVisible()
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __graphStore: {
            getState: () => {
              getProjectPayload: () => {
                document: unknown
                nodes: unknown
                edges: unknown
                canvasByGraph: unknown
                navigationPath: unknown
              }
              loadProject: (p: unknown) => void
            }
          }
        }
      ).__graphStore.getState()
      const payload = store.getProjectPayload()
      store.loadProject({
        document: payload.document,
        nodes: payload.nodes,
        edges: payload.edges,
        canvasByGraph: payload.canvasByGraph,
        navigationPath: payload.navigationPath,
      })
    })
    await expect(page.getByTestId('graph-dirty-indicator')).toHaveCount(0)
    const dirty = await page.evaluate(
      () =>
        (
          window as unknown as { __graphStore: { getState: () => { isDirty: boolean } } }
        ).__graphStore.getState().isDirty,
    )
    expect(dirty).toBe(false)
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 152, 248, 296, 344, 392, 440, 488, 536, 584, 632, 680, 728, 776')
  })

  test('cycle-777: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /docs/i)
    await expect(page.getByTestId('cycle-777-docs-tooltip')).toBeAttached()
  })

  test('cycle-778: open-shortcuts user flow', async ({ page }) => {
    await page.keyboard.press('?')
    const modal = page.getByTestId('shortcuts-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toHaveAttribute('data-cycle-alt3', '778')
    await expect(modal).toContainText(/Keyboard shortcuts/i)
    await expect(modal).toContainText(/Save project/i)
    await page.keyboard.press('?')
    await expect(modal).toHaveCount(0)
  })

  test('cycle-779: persist toolbar redo last-used option', async ({ page }) => {
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
    const persisted = page.getByTestId('toolbar-redo-persisted')
    await expect(persisted).toHaveAttribute('data-cycle-redo-persist-alt4', '779')
  })

  test('cycle-780: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch77-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle-copy-alt8', '780')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
  })
})
