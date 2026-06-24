import { test, expect } from '@playwright/test'
import { createDefaultDocument } from '../src/lib/codegen/pythonGenerator'
import { generateLangsmithJson } from '../src/lib/codegen/pythonProjectGenerator'
import { viewportStorageKey } from '../src/lib/viewportStorage'

test.describe('SDLC Batch 1 — cycles 11–20', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-11: toolbar redo restores graph after reset', async ({ page }) => {
    await page.getByTestId('graph-name-input').fill('Redo Test Graph')
    await page.getByRole('button', { name: /Reset/i }).click()
    const redo = page.getByTestId('toolbar-redo')
    await expect(redo).toBeEnabled()
    await expect(redo).toHaveAttribute('title', /Redo last reset/i)
    await redo.click()
    await expect(page.getByTestId('graph-name-input')).toHaveValue('Redo Test Graph')
  })

  test('cycle-12: deploy tab shows loading skeleton when busy', async ({ page }) => {
    await page.route('**/api/deploy/helm', async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, release: 'test', output: 'dry-run ok' }),
      })
    })
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-deploy').click()
    await expect(page.getByTestId('deploy-panel')).toBeVisible()
    await page.getByRole('button', { name: /Dry run/i }).click()
    await expect(page.getByTestId('deploy-tab-skeleton')).toBeVisible()
  })

  test('cycle-13: skills tab empty-state hint', async ({ page }) => {
    await page.getByTestId('designer-tab-assets').click()
    await page.getByRole('button', { name: /Remove/i }).first().click()
    await expect(page.getByTestId('skills-empty-hint')).toBeVisible()
    await expect(page.getByTestId('skills-empty-hint')).toContainText(/No skills yet/i)
  })

  test('cycle-14: snap-to-grid toggle enables snap on canvas', async ({ page }) => {
    const toggle = page.getByTestId('canvas-snap-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveClass(/active/)
  })

  test('cycle-15: langsmith.json includes generator_version 0.1.0', async () => {
    const doc = createDefaultDocument()
    const json = JSON.parse(generateLangsmithJson(doc)) as {
      langstitch: { generator_version: string }
    }
    expect(json.langstitch.generator_version).toBe('0.1.0')
  })

  test('cycle-16: health API returns build_time ISO field', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    const body = await res.json()
    expect(body.build_time).toBeTruthy()
    expect(body.build_time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('cycle-17: eval result shows latency-ms', async ({ page }) => {
    await page.getByTestId('toolbar-platform').click()
    await page.getByTestId('platform-tab-eval').click()
    await page.getByTestId('eval-dataset-name').fill('batch1_latency_dataset')
    await page.getByRole('button', { name: /Validate config/i }).click()
    await expect(page.getByTestId('eval-result')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('eval-result-latency')).toBeVisible()
    await expect(page.getByTestId('eval-result-latency')).toContainText(/ms\)/)
  })

  test('cycle-18: shortcuts modal traps focus', async ({ page }) => {
    await page.getByTestId('toolbar-shortcuts').click()
    const modal = page.getByTestId('shortcuts-modal')
    await expect(modal).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const closeFocused = await page.getByRole('button', { name: 'Close' }).evaluate(
      (el) => el === document.activeElement,
    )
    expect(closeFocused).toBe(true)
  })

  test('cycle-19: Ctrl+E toggles platform drawer', async ({ page }) => {
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
    await page.keyboard.press('Control+e')
    await expect(page.getByTestId('platform-drawer')).toBeVisible()
    await page.keyboard.press('Control+e')
    await expect(page.getByTestId('platform-drawer')).toHaveCount(0)
  })

  test('cycle-20: viewport persists in localStorage by project name', async ({ page }) => {
    const projectName = 'my_langgraph'
    const key = viewportStorageKey(projectName)
    await page.getByRole('button', { name: 'Zoom Out' }).click()
    await page.waitForTimeout(400)
    const storedAfterZoom = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
    expect(storedAfterZoom).toBeTruthy()
    const parsed = JSON.parse(storedAfterZoom!) as { x: number; y: number; zoom: number }
    expect(typeof parsed.zoom).toBe('number')
    await page.reload()
    const storedAfterReload = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
    expect(storedAfterReload).toBe(storedAfterZoom)
  })
})
