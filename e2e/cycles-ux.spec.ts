import { test, expect } from '@playwright/test'

test.describe('SDLC Cycle UX features', () => {
  test('cycle-02: eval summary in graph designer', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('designer-tab-graph').click()
    await expect(page.getByTestId('eval-designer-summary')).toBeVisible()
  })

  test('cycle-03: Ctrl+S triggers save flow', async ({ page }) => {
    await page.goto('/')
    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Control+s')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.langstitch.json')
  })

  test('cycle-04: platform health includes version', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    const body = await res.json()
    expect(body.version).toBeTruthy()
    expect(body.python).toBeTruthy()
  })

  test('cycle-07: save shows timestamp after save click', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('toolbar-save').click()
    await expect(page.getByTestId('toolbar-saved-at')).toBeVisible({ timeout: 3000 })
  })

  test('cycle-09: shortcuts modal opens', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('toolbar-shortcuts').click()
    await expect(page.getByTestId('shortcuts-modal')).toBeVisible()
  })
})
