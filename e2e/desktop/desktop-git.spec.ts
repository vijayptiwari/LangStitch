import { test, expect } from '@playwright/test'
import { launchLangtailorDesktop } from './launch'

test.describe('LangTailor desktop git', () => {
  test.skip(!process.env.LANGTAILOR_ELECTRON_E2E, 'Set LANGTAILOR_ELECTRON_E2E=1 after building desktop')

  test('SCM panel loads git status', async () => {
    const app = await launchLangtailorDesktop()
    const win = await app.firstWindow()
    await expect(win.locator('[data-testid="ide-shell"]')).toBeVisible({ timeout: 30_000 })
    await win.getByRole('button', { name: 'Source Control' }).click()
    await expect(win.getByTestId('scm-panel')).toBeVisible()
    await expect(win.getByTestId('scm-panel')).toContainText(/main|git|Not a git/i)
    await app.close()
  })
})
