import { readFileSync } from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'

const FIXTURE = path.join('e2e', 'fixtures', 'basic-agent.langstitch.json')

test.describe('SDLC Batch 29 — cycles 291–300', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-291: export manifest lists eval-dataset in bundle', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch29_manifest_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByRole('button', { name: /Export/i }).click()
    await expect(page.getByTestId('export-dry-run-preview')).toHaveAttribute(
      'data-cycle-manifest-alt',
      '291',
    )
    await page.getByTestId('export-dry-run-preview').click()
    const preview = page.getByTestId('export-manifest-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/eval-dataset/i)
    await expect(preview).toContainText(/batch29_manifest_ds/)
    const source = readFileSync('src/lib/codegen/bundleGenerator.ts', 'utf-8')
    expect(source).toContain('cycles 51, 111, 231, 291')
  })

  test('cycle-292: OpenAPI-style description for /api/export', async ({ request }) => {
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
    expect(source).toContain('cycles 232, 292')
  })

  test('cycle-293: eval history last-293 runs in session', async ({ page }) => {
    await page.evaluate(() => {
      const entries = Array.from({ length: 300 }, (_, i) => ({
        at: new Date().toISOString(),
        datasetName: `batch29_hist_${i}`,
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
    expect(count).toBeLessThanOrEqual(293)
    const source = readFileSync('src/components/platform/PlatformDrawer.tsx', 'utf-8')
    expect(source).toContain('EVAL_HISTORY_LIMIT = 293')
  })

  test('cycle-294: screen-reader live region for eval finished', async ({ page }) => {
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
        eval: { enabled: true, datasetName: 'batch29_live_ds', datasetId: '' },
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByRole('button', { name: /Validate config/i }).click()
    const live = page.getByTestId('eval-finished-live-region')
    await expect(live).toHaveAttribute('data-cycle-live-alt', '294')
    await expect(live).toContainText(/Eval (validation )?finished|Eval run failed/i, {
      timeout: 15_000,
    })
    await expect(live).toHaveAttribute('aria-live', 'polite')
  })

  test('cycle-295: Alt+G toggles platform drawer', async ({ page }) => {
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('Alt+g')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Alt+g')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-295-toggle-platform')).toBeVisible()
  })

  test('cycle-296: dirty flag clears after successful import', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __graphStore: { getState: () => { setDocumentMeta: (m: { name: string }) => void } }
        }
      ).__graphStore.getState().setDocumentMeta({ name: 'Batch29 Dirty Graph' })
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
    const source = readFileSync('src/store/graphStore.ts', 'utf-8')
    expect(source).toContain('cycles 152, 248, 296')
  })

  test('cycle-297: help tooltip links to docs for core', async ({ page }) => {
    const link = page.getByTestId('help-docs-link-core')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /langstitch\.com\/docs/)
    await expect(page.getByTestId('cycle-297-docs-tooltip')).toBeAttached()
  })

  test('cycle-298: health metadata regression after reload', async ({ page, request }) => {
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('cycle-298-health-reload')).toBeAttached()
    await page.reload()
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { build_time?: string; version?: string }
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.version).toBeTruthy()
    await page.getByTestId('toolbar-platform').click()
    await expect(page.getByTestId('platform-health-last-sync')).toBeVisible({ timeout: 10_000 })
  })

  test('cycle-299: persist toolbar redo last-used option', async ({ page }) => {
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
    await expect(persisted).toHaveAttribute('data-cycle-redo-persist', '299')
    await expect(persisted).toContainText(parsed.at!)
  })

  test('cycle-300: copy-to-clipboard for Platform Git output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('toolbar-platform').click()
    await page.route('**/api/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from('PK\x03\x04batch29-git'),
      })
    })
    await page.getByRole('button', { name: /Export/i }).click()
    await page.getByRole('button', { name: /Download ZIP/i }).click()
    await expect(page.getByTestId('platform-log')).toBeVisible({ timeout: 10_000 })
    const copyBtn = page.getByTestId('git-output-copy')
    await expect(copyBtn).toHaveAttribute('data-cycle-copy', '300')
    await copyBtn.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/Export|bundle|Git|Eval/i)
  })
})
