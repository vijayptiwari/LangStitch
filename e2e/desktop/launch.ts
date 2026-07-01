import path from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron } from '@playwright/test'

const require = createRequire(import.meta.url)

export async function launchLangtailorDesktop() {
  const desktopRoot = path.join(process.cwd(), 'langtailor/desktop')
  const electronExecutable = require(path.join(desktopRoot, 'node_modules/electron')) as string
  return electron.launch({
    executablePath: electronExecutable,
    cwd: desktopRoot,
    args: ['.'],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  })
}
