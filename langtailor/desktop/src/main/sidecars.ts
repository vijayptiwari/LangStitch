import { BrowserWindow, ipcMain, app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSettings } from './settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let lspProcess: ChildProcess | null = null
let debugProcess: ChildProcess | null = null

export function registerSidecarHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('langtailor:parse-graph', async (_e, projectRoot: string) => {
    const script = path.join(getRuntimeDir(), 'parse_graph.py')
    return runPythonScript(script, [projectRoot])
  })

  ipcMain.handle('langtailor:lsp-start', async (_e, root: string) => {
    stopLsp()
    // Prefer the bundled open-source Python language server (python-lsp-server),
    // launched through the app's Python so it ships with the desktop runtime.
    // Fall back to a globally installed pyright if pylsp is unavailable.
    const python = getSettings().pythonPath || 'python'
    try {
      lspProcess = spawn(python, ['-m', 'pylsp'], {
        cwd: root,
        shell: false,
        windowsHide: true,
      })
      lspProcess.on('error', () => startPyrightFallback(root))
      return { ok: true, server: 'pylsp' }
    } catch {
      startPyrightFallback(root)
      return { ok: true, server: 'pyright' }
    }
  })

  ipcMain.handle('langtailor:lsp-stop', async () => {
    stopLsp()
    return { ok: true }
  })

  ipcMain.handle('langtailor:debug-start', async (_e, config: { program: string; cwd: string }) => {
    stopDebug()
    const python = getSettings().pythonPath
    const win = getWindow()
    debugProcess = spawn(
      python,
      ['-m', 'debugpy', '--listen', '5678', '--wait-for-client', config.program],
      { cwd: config.cwd, shell: true },
    )
    debugProcess.stdout?.on('data', (d) => {
      win?.webContents.send('langtailor:debug', d.toString())
    })
    debugProcess.stderr?.on('data', (d) => {
      win?.webContents.send('langtailor:debug', d.toString())
    })
    return { ok: true, port: 5678 }
  })

  ipcMain.handle('langtailor:debug-stop', async () => {
    stopDebug()
    return { ok: true }
  })

  ipcMain.handle('langtailor:check-syntax', async (_e, files: Record<string, string>) => {
    const script = path.join(getRuntimeDir(), 'check_syntax.py')
    return runPythonStdin(script, JSON.stringify({ files }))
  })
}

function runPythonStdin(script: string, stdin: string): Promise<string> {
  const python = getSettings().pythonPath
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [script], { shell: false, windowsHide: true })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => {
      out += d.toString()
    })
    proc.stderr.on('data', (d) => {
      err += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err || `exit ${code}`))
    })
    proc.stdin.write(stdin)
    proc.stdin.end()
  })
}

function getRuntimeDir(): string {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../../../runtime')
  }
  return path.join(process.resourcesPath, 'runtime')
}

function runPythonScript(script: string, args: string[]): Promise<string> {
  const python = getSettings().pythonPath
  return new Promise((resolve, reject) => {
    const proc = spawn(python, [script, ...args], { shell: false, windowsHide: true })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.stderr.on('data', (d) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err || `exit ${code}`))
    })
  })
}

function startPyrightFallback(root: string): void {
  const pyright =
    process.platform === 'win32' ? 'pyright-langserver.cmd' : 'pyright-langserver'
  try {
    lspProcess = spawn(pyright, ['--stdio'], { cwd: root, shell: true })
  } catch {
    lspProcess = null
  }
}

function stopLsp(): void {
  lspProcess?.kill()
  lspProcess = null
}

function stopDebug(): void {
  debugProcess?.kill()
  debugProcess = null
}

export function sendToRenderer(win: BrowserWindow, channel: string, payload: unknown): void {
  win.webContents.send(channel, payload)
}
