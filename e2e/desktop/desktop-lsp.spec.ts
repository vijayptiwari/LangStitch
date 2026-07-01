import { test, expect } from '@playwright/test'
import { launchLangtailorDesktop } from './launch'

test.describe('LangTailor desktop LSP / diagnostics', () => {
  test.skip(!process.env.LANGTAILOR_ELECTRON_E2E, 'Set LANGTAILOR_ELECTRON_E2E=1 after building desktop')

  test('problems panel is reachable from status bar', async () => {
    const app = await launchLangtailorDesktop()
    const win = await app.firstWindow()
    await expect(win.locator('[data-testid="ide-shell"]')).toBeVisible({ timeout: 30_000 })
    await win.getByTestId('status-bar').getByText(/problems|errors|warnings|No problems/i).first().click()
    await expect(win.getByTestId('problems-panel')).toBeVisible()
    await app.close()
  })
})
