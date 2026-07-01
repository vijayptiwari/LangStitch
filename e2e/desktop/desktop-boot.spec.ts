import { test, expect } from '@playwright/test'
import { launchLangtailorDesktop } from './launch'

test.describe('LangTailor desktop', () => {
  test.skip(!process.env.LANGTAILOR_ELECTRON_E2E, 'Set LANGTAILOR_ELECTRON_E2E=1 after building desktop')

  test('app boots', async () => {
    const app = await launchLangtailorDesktop()
    const win = await app.firstWindow()
    await expect(win.getByTestId('ide-shell')).toBeVisible({
      timeout: 30_000,
    })
    await app.close()
  })
})
