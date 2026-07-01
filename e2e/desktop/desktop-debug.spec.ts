import { test, expect } from '@playwright/test'
import { launchLangtailorDesktop } from './launch'

test.describe('LangTailor desktop debug', () => {
  test.skip(!process.env.LANGTAILOR_ELECTRON_E2E, 'Set LANGTAILOR_ELECTRON_E2E=1 after building desktop')

  test('run panel exposes debug controls', async () => {
    const app = await launchLangtailorDesktop()
    const win = await app.firstWindow()
    await expect(win.locator('[data-testid="ide-shell"]')).toBeVisible({ timeout: 30_000 })
    await win.getByRole('button', { name: 'Run and Debug' }).click()
    await expect(win.getByTestId('run-panel')).toBeVisible()
    await expect(win.getByTestId('debug-graph')).toBeVisible()
    await win.getByTestId('debug-graph').click()
    await expect(win.getByTestId('debug-console')).toBeVisible({ timeout: 15_000 })
    await app.close()
  })
})
