import { test, expect } from '@playwright/test'

test.describe('IDE synced selection', () => {
  test('selecting a canvas node opens its module in code view', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()

    await page.evaluate(() => window.__langtailorIdeTest?.selectNode('llm-1'))
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()

    const activeTab = page.locator('.code-tab.active')
    await expect(activeTab).toContainText(/llm/i)
    await expect(page.locator('.code-tree-item.active')).toContainText(/llm/i)
  })
})
