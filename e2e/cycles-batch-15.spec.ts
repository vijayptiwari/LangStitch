import { test, expect } from '@playwright/test'

test.describe('SDLC Batch 15 — cycle 151', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('langstitch-app')).toBeVisible()
  })

  test('cycle-151: Alt+L focuses node palette search', async ({ page }) => {
    const search = page.getByTestId('palette-search-input')
    await expect(search).toBeVisible()
    await page.keyboard.press('Alt+l')
    await expect(search).toBeFocused()
    await search.fill('llm')
    await expect(page.getByTestId('palette-llm')).toBeVisible()
    await expect(page.getByTestId('palette-start')).toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByTestId('cycle-151-alt-l-focus-search')).toBeVisible()
  })
})
