import { BrowserWindow, ipcMain } from 'electron'
import { getSettings, setSetting } from './settings.js'

export function registerAuthHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('langtailor:get-auth-token', async () => ({
    token: getSettings().authToken ?? null,
  }))

  ipcMain.handle('langtailor:set-auth-token', async (_e, token: string | null) => {
    setSetting('authToken', token ?? '')
    getWindow()?.webContents.send('langtailor:auth-token', token ?? null)
    return { ok: true }
  })
}

/** Handle langtailor://auth/callback?token=… deep links from the OAuth flow. */
export function handleAuthDeepLink(url: string, getWindow: () => BrowserWindow | null): void {
  if (!url.startsWith('langtailor://')) return
  try {
    const parsed = new URL(url)
    const isCallback =
      parsed.pathname.includes('callback') || parsed.hostname === 'auth'
    if (!isCallback) return
    const token = parsed.searchParams.get('token')
    const error = parsed.searchParams.get('error')
    if (error) {
      getWindow()?.webContents.send('langtailor:auth-error', error)
      return
    }
    if (token) {
      setSetting('authToken', token)
      getWindow()?.webContents.send('langtailor:auth-token', token)
    }
  } catch {
    /* ignore malformed URLs */
  }
}

export function extractDeepLink(argv: string[]): string | undefined {
  return argv.find((a) => a.startsWith('langtailor://'))
}
