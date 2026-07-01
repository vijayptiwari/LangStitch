import { execSync } from 'node:child_process'
import path from 'node:path'

export default async function globalSetup() {
  const desktopDir = path.join(process.cwd(), 'langtailor/desktop')
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === 'false') {
    delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD
  }
  execSync('npm run ensure-electron', { cwd: desktopDir, stdio: 'inherit' })
  execSync('npm run build', { cwd: desktopDir, stdio: 'inherit' })
}
