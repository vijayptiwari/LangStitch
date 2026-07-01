import { test, expect } from '@playwright/test'

test.describe('IDE export / build artifacts', () => {
  test('code view includes project build files from graph codegen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()
    await page.getByTestId('toggle-code').click()
    await expect(page.getByTestId('code-editor-view')).toBeVisible()

    await page.waitForFunction(() => {
      const files = window.__langtailorIdeTest?.getVirtualFiles() ?? {}
      return Object.keys(files).some((p) => p.endsWith('pyproject.toml'))
    })

    const files = await page.evaluate(() => Object.keys(window.__langtailorIdeTest?.getVirtualFiles() ?? {}))
    expect(files.some((p) => p.endsWith('pyproject.toml'))).toBe(true)
    expect(files.some((p) => p.includes('/graphs/') && p.endsWith('.py'))).toBe(true)
    expect(files.some((p) => p.includes('/nodes/') && p.endsWith('.py'))).toBe(true)
  })
})
