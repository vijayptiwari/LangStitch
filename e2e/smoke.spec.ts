import { test, expect } from '@playwright/test'

test.describe('LangStitch smoke', () => {
  test('loads the visual IDE', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
    await expect(page.getByTestId('brand-title')).toHaveText('LangStitch')
    await expect(page.getByTestId('node-palette')).toBeVisible()
    await expect(page.getByTestId('graph-canvas')).toBeVisible()
    await expect(page.getByTestId('designer-panel')).toBeVisible()
  })

  test('default demo graph renders six nodes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow__node')
    await expect(page.locator('.react-flow__node')).toHaveCount(6)
  })

  test('platform API is healthy', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8787/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
