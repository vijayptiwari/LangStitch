import { test, expect } from '@playwright/test'

test.describe('IDE view switch', () => {
  test('toggles between canvas and code views', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()
    await page.getByTestId('toggle-canvas').click()
    await expect(page.getByTestId('toggle-canvas')).toHaveClass(/active/)
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
  })
})
