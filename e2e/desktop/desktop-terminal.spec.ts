import { test, expect } from '@playwright/test'
import { launchLangtailorDesktop } from './launch'

test.describe('LangTailor desktop terminal', () => {
  test.skip(!process.env.LANGTAILOR_ELECTRON_E2E, 'Set LANGTAILOR_ELECTRON_E2E=1 after building desktop')

  test('integrated terminal panel opens', async () => {
    const app = await launchLangtailorDesktop()
    const win = await app.firstWindow()
    await expect(win.locator('[data-testid="ide-shell"]')).toBeVisible({ timeout: 30_000 })
    await win.getByTestId('status-bar').getByText('Terminal').click()
    await expect(win.getByTestId('terminal-panel')).toBeVisible()
    await expect(win.getByTestId('terminal-xterm')).toBeVisible()
    await app.close()
  })
})
