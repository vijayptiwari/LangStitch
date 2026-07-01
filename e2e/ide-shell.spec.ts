import { test, expect } from '@playwright/test'

test.describe('IDE shell', () => {
  test('command palette opens', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Control+Shift+P')
    await expect(page.getByTestId('command-palette')).toBeVisible()
  })

  test('activity bar panels render', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('activity-bar')).toBeVisible()
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()
  })
})
