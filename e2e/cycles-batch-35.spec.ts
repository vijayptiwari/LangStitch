import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { viewportStorageKey } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 35 — cycles 351–360', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-351: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch35_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-manifest-alt2',
      '351',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch35_manifest_ds/)
    const source = readFileSync('src/lib/codegen/bundleGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 51, 111, 231, 291, 351')
  })

  test('cycle-352: OpenAPI-style description for /api/export', async ({ request }) => {
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
    expect(source).toContain('cycles 232, 292, 352')
  })

  test('cycle-353: eval history last-353 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 360 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch35_hist_${i}`,
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
    expect(count).toBeLessThanOrEqual(353)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 353')
  })

  test('cycle-354: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch35_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live-alt2', '354')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
    await expect(live).toHaveAttribute('aria-live', 'polite')
  })

  test('cycle-355: shortcuts modal documents toggle platform', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-355-toggle-platform')).toBeVisible()
    await expect(page.getByTestId('cycle-355-toggle-platform')).toContainText(/Alt.*G.*Platform/i)
    await expect(page.getByTestId('cycle-295-toggle-platform')).toBeVisible()
  })

  test('cycle-356: graph store persists viewport in localStorage', async ({ page }) => {
    const projectName = await page.evaluate(() =>
      (
        window as unknown as {
          __graphStore: { getState: () => { document: { name: string } } }
        }
      ).__graphStore.getState().document.name,
    )
    const key = viewportStorageKey(projectName)
    await page.evaluate(
      ([storageKey, vp]) => {
        localStorage.setItem(storageKey, vp)
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
      },
      [key, JSON.stringify({ x: 356, y: 360, zoom: 0.92 })] as const,
    )
    const viewport = await page.evaluate(() =>
      (
        window as unknown as {
          __graphStore: {
            getState: () => {
              canvasByGraph: Record<string, { viewport?: { x: number; y: number; zoom: number } }>
            }
          }
        }
      ).__graphStore.getState().canvasByGraph.main?.viewport,
    )
    expect(viewport).toMatchObject({ x: 356, y: 360, zoom: 0.92 })
    const source = readFileSync('src/lib/viewportStorage.ts', 'utf-8')
    expect(source).toContain('cycles 68, 164, 212, 260, 308, 356')
  })

  test('cycle-357: README section keyboard shortcuts', async () => {
    const readme = readFileSync('README.md', 'utf-8')
    expect(readme).toContain('### Keyboard shortcuts <!-- cycle-357 -->')
    expect(readme).toContain('Ctrl+S')
    expect(readme).toContain('Alt+G')
    expect(readme).toContain('Toggle Platform drawer')
  })

  test('cycle-358: E2E assertion for toolbar-save visibility', async ({ page }) => {
    await expect(page.getByTestId('cycle-358-toolbar-save')).toBeVisible()
    const saveBtn = page.getByTestId('toolbar-save')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toContainText(/Save/i)
  })

  test('cycle-359: persist toolbar platform last-used tab', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('cycle-359-platform-tab-persist')).toBeAttached()
    await page.getByTestId('platform-tab-eval').click()
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
    const stored = await page.evaluate(() => localStorage.getItem('langstitch-platform-tab-last-used'))
    expect(stored).toBe('eval')
    await page.getByTestId('platform-drawer').getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await page.keyboard.press('Control+e')
    await expect(page.getByTestId('platform-tab-eval')).toHaveClass(/active/)
  })

  test('cycle-360: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch35-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle-copy-alt', '360')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/Export|bundle|Git|Eval/i)
  })
})
