import { test, expect } from '@playwright/test'

test.describe('IDE deletion guard', () => {
  test('IDE shell and problems panel are reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('ide-shell')).toBeVisible()

    // Open the Problems panel via the status bar (parser diagnostics surface here).
    await page.getByTestId('status-bar').getByText(/problems|errors|warnings/i).first().click()
    await expect(page.getByTestId('problems-panel')).toBeVisible()
  })

  // Note: the destructive confirm() dialog for nodes carrying custom code is
  // covered by unit tests (src/store/__tests__/deletionGuard.test.ts) since
  // window.confirm cannot be deterministically driven across all canvas paths
  // in headless CI without flake.
})
