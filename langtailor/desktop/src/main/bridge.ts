import { ipcMain, type BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import { getCurrentDocPath } from './commands.js'

const pendingHostRequests = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
>()

export function registerWebviewBridge(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('webview:message', async (_e, msg: Record<string, unknown>) => {
    const win = getWindow()
    if (!win) return

    const type = msg.type as string | undefined
    const requestId = msg.requestId as string | undefined

    if (type === 'edit' && typeof msg.text === 'string') {
      const docPath = getCurrentDocPath()
      if (docPath) {
        try {
          await fs.writeFile(docPath, msg.text, 'utf8')
        } catch {
          /* user may save via menu */
        }
      }
      return
    }

    if (type === 'ready') {
      const docPath = getCurrentDocPath()
      if (docPath) {
        try {
          const text = await fs.readFile(docPath, 'utf8')
          win.webContents.send('host:message', { type: 'init', text })
        } catch {
          win.webContents.send('host:message', { type: 'init', text: '{}' })
        }
      }
      return
    }

    if (requestId && type?.startsWith('request')) {
      win.webContents.send('host:message', { ...msg, type: type })
    }
  })
}

export function postMessageWithResponse(
  win: BrowserWindow,
  msg: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<unknown> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingHostRequests.delete(requestId)
      reject(new Error(`Timed out: ${msg.type}`))
    }, timeoutMs)
    pendingHostRequests.set(requestId, { resolve, reject, timer })
    win.webContents.send('host:message', { ...msg, requestId })
  })
}

export function handleWebviewResponse(msg: Record<string, unknown>): void {
  const requestId = msg.requestId as string | undefined
  if (!requestId) return
  const pending = pendingHostRequests.get(requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingHostRequests.delete(requestId)
  if (msg.error) pending.reject(new Error(String(msg.error)))
  else pending.resolve(msg)
}
