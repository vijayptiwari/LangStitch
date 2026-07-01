import { test, expect } from '@playwright/test'

test.describe('IDE sync UI -> code', () => {
  test('switching to code view shows generated node modules', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()

    // The default demo graph has nodes; the code view should expose their modules.
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()
    await expect(page.getByTestId('code-file-tree')).toBeVisible()

    // At least one generated Python module appears in the tree.
    const tree = page.getByTestId('code-file-tree')
    await expect(tree.locator('button', { hasText: '.py' }).first()).toBeVisible()
  })
})
