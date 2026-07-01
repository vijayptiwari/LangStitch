import { BrowserWindow, ipcMain } from 'electron'
import * as pty from 'node-pty'

let shellPty: pty.IPty | null = null

export function registerTerminalHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    'langtailor:terminal-create',
    async (_e, size: { cols: number; rows: number }) => {
      try {
        shellPty?.kill()
      } catch {
        /* ignore */
      }
      shellPty = null
      const shell =
        process.platform === 'win32'
          ? process.env.COMSPEC || 'powershell.exe'
          : process.env.SHELL || '/bin/bash'
      try {
        shellPty = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: Math.max(size.cols, 10),
          rows: Math.max(size.rows, 3),
          cwd: process.cwd(),
          env: { ...process.env } as Record<string, string>,
          // ConPTY's console-list agent crashes inside Electron on Windows
          // (AttachConsole fails). Fall back to winpty there.
          useConpty: process.platform !== 'win32',
        } as pty.IWindowsPtyForkOptions)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        getWindow()?.webContents.send(
          'langtailor:terminal-data',
          `\r\n\x1b[31mFailed to start terminal: ${message}\x1b[0m\r\n`,
        )
        return { ok: false, error: message }
      }
      shellPty.onData((data) => {
        getWindow()?.webContents.send('langtailor:terminal-data', data)
      })
      shellPty.onExit(() => {
        shellPty = null
      })
      return { ok: true }
    },
  )

  ipcMain.on('langtailor:terminal-write', (_e, data: string) => {
    shellPty?.write(data)
  })

  ipcMain.on('langtailor:terminal-resize', (_e, size: { cols: number; rows: number }) => {
    shellPty?.resize(Math.max(size.cols, 10), Math.max(size.rows, 3))
  })

  ipcMain.handle('langtailor:terminal-kill', async () => {
    shellPty?.kill()
    shellPty = null
    return { ok: true }
  })
}
