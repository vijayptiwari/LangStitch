import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn, type ChildProcess } from 'node:child_process'
import { getSettings, setSetting } from './settings.js'

const STARTER_GRAPH = `{
  "version": 1,
  "name": "my_graph",
  "description": "A LangTailor graph",
  "stateFields": [],
  "subgraphs": [],
  "nodes": [],
  "edges": []
}
`

const outputLines: string[] = []
// The most recent successful Build output dir (holds the .venv used by Run).
let lastBuildDir: string | null = null
// The running graph server started by Run (so it can be stopped / replaced).
let serverProcess: ChildProcess | null = null

// One IDE window = one workspace. Track each window's open document path keyed
// by its webContents id so multiple windows don't clobber each other.
const docPaths = new Map<number, string>()

function senderWindowId(e: { sender: Electron.WebContents }): number | null {
  return BrowserWindow.fromWebContents(e.sender)?.webContents.id ?? null
}

function setDocPath(id: number | null, filePath: string): void {
  if (id != null) docPaths.set(id, filePath)
}

/** Forget a window's workspace mapping when it closes. */
export function clearDocPath(id: number): void {
  docPaths.delete(id)
}

/**
 * Resolve the active document path. Prefers the focused window's workspace,
 * falling back to the only-open workspace when nothing is focused.
 */
export function getCurrentDocPath(): string | null {
  const focusedId = BrowserWindow.getFocusedWindow()?.webContents.id
  if (focusedId != null && docPaths.has(focusedId)) return docPaths.get(focusedId)!
  if (docPaths.size === 1) return [...docPaths.values()][0]
  return null
}

const isWin = process.platform === 'win32'

/** Path to the venv's python executable inside a built project dir. */
function venvPython(buildDir: string): string {
  return isWin
    ? path.join(buildDir, '.venv', 'Scripts', 'python.exe')
    : path.join(buildDir, '.venv', 'bin', 'python')
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export function registerCommandHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('langtailor:confirm', async (_e, message: string) => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message,
    })
    return result.response === 0
  })

  ipcMain.handle('langtailor:new-graph', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getWindow()
    const opts = {
      defaultPath: 'my_graph.langstitch.json',
      filters: [{ name: 'LangStitch', extensions: ['langstitch.json', 'json'] }],
    }
    const picked = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (picked.canceled || !picked.filePath) return { ok: false }
    await fs.writeFile(picked.filePath, STARTER_GRAPH, 'utf8')
    setDocPath(senderWindowId(e), picked.filePath)
    applyWindowTitle(win, picked.filePath)
    win?.webContents.send('host:init', { text: STARTER_GRAPH, path: picked.filePath })
    addRecent(picked.filePath)
    return { ok: true, path: picked.filePath }
  })

  ipcMain.handle('langtailor:open-project', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getWindow()
    const opts = {
      filters: [{ name: 'LangStitch', extensions: ['langstitch.json', 'zip', 'json'] }],
      properties: ['openFile' as const],
    }
    const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (picked.canceled || !picked.filePaths[0]) return { ok: false }
    const fp = picked.filePaths[0]
    const text = await fs.readFile(fp, 'utf8')
    setDocPath(senderWindowId(e), fp)
    applyWindowTitle(win, fp)
    win?.webContents.send('host:init', { text, path: fp })
    addRecent(fp)
    return { ok: true, path: fp }
  })

  // Open a known path (e.g. a recent project) into the requesting window.
  ipcMain.handle('langtailor:open-path', async (e, fp: string) => {
    if (!fp) return { ok: false }
    const win = BrowserWindow.fromWebContents(e.sender) ?? getWindow()
    try {
      const text = await fs.readFile(fp, 'utf8')
      setDocPath(senderWindowId(e), fp)
      applyWindowTitle(win, fp)
      win?.webContents.send('host:init', { text, path: fp })
      addRecent(fp)
      return { ok: true, path: fp }
    } catch {
      return { ok: false, error: `Could not open ${fp}` }
    }
  })

  ipcMain.handle('langtailor:save', async (e, text: string) => {
    const id = senderWindowId(e)
    let docPath = id != null ? docPaths.get(id) ?? null : null
    if (!docPath) {
      const win = BrowserWindow.fromWebContents(e.sender) ?? getWindow()
      const opts = { filters: [{ name: 'LangStitch', extensions: ['langstitch.json'] }] }
      const picked = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (picked.canceled || !picked.filePath) return { ok: false }
      docPath = picked.filePath
      setDocPath(id, docPath)
      applyWindowTitle(win, docPath)
      addRecent(docPath)
    }
    await fs.writeFile(docPath, text, 'utf8')
    return { ok: true, path: docPath }
  })

  ipcMain.handle('langtailor:recent-projects', () => getSettings().recentProjects.slice(0, 10))

  ipcMain.handle('langtailor:write-files', async (_e, dir: string, files: Record<string, string>) => {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel)
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.writeFile(full, content, 'utf8')
    }
    return { ok: true }
  })

  ipcMain.handle('langtailor:run-process', async (_e, cmd: string, cwd: string) => {
    return runInOutput(cmd, cwd, getWindow)
  })

  ipcMain.handle(
    'langtailor:run-graph',
    async (
      _e,
      payload: { files: Record<string, string>; mode: 'run' | 'test' | 'debug' | 'build' },
    ) => {
      const mainPy = Object.keys(payload.files).find((f) => f.endsWith('/__main__.py'))
      const pkgDir = mainPy?.split('/src/')[1]?.split('/')[0]

      // Build emits a persistent project folder AND a ready-to-run virtual
      // environment with the project installed (editable). Run then reuses that
      // venv. (run/test/debug paths below still use the venv or a temp dir.)
      if (payload.mode === 'build') {
        try {
          const outDir = resolveBuildDir(pkgDir)
          // Preserve an existing .venv across rebuilds (creating it is the slow
          // part); only the generated sources are rewritten clean.
          await cleanSourcesPreservingVenv(outDir)
          await fs.mkdir(outDir, { recursive: true })
          for (const [rel, content] of Object.entries(payload.files)) {
            const full = path.join(outDir, rel)
            await fs.mkdir(path.dirname(full), { recursive: true })
            await fs.writeFile(full, content, 'utf8')
          }
          appendOutput(`Building project into ${outDir}\n`, getWindow)

          const basePython = getSettings().pythonPath || 'python'
          const vpy = venvPython(outDir)

          // 1. Create the virtual environment (skip if it already exists).
          if (!(await pathExists(vpy))) {
            appendOutput('\n[1/2] Creating virtual environment (.venv)…\n', getWindow)
            const venvRes = await runInOutput(
              `"${basePython}" -m venv .venv`,
              outDir,
              getWindow,
              'venv',
            )
            if (venvRes.exitCode !== 0 || !(await pathExists(vpy))) {
              appendOutput('\nBuild failed — could not create virtual environment\n', getWindow)
              return { ...venvRes, ok: false, cwd: outDir, outDir }
            }
          } else {
            appendOutput('\n[1/2] Reusing existing .venv\n', getWindow)
          }

          // 2. Install the project (and its `langstitch` dependency from
          //    PyPI) editable into the venv.
          appendOutput(
            '\n[2/2] Installing project + langstitch from PyPI (pip install -e .)…\n',
            getWindow,
          )
          const installRes = await runInOutput(
            `"${vpy}" -m pip install -e .`,
            outDir,
            getWindow,
            'project install',
          )
          const ok = installRes.exitCode === 0
          if (ok) {
            lastBuildDir = outDir
            appendOutput(
              `\nBuild succeeded — ${Object.keys(payload.files).length} files written and installed into:\n${path.join(outDir, '.venv')}\n`,
              getWindow,
            )
            shell.showItemInFolder(outDir)
          } else {
            appendOutput('\nBuild failed — pip install reported errors (see above)\n', getWindow)
          }
          return { ...installRes, ok, cwd: outDir, outDir }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          appendOutput(`\nBuild crashed: ${msg}\n`, getWindow)
          return { ok: false, exitCode: 1 }
        }
      }

      // Run launches the installed graph server using the Build venv. It needs a
      // prior successful Build (which created the venv and installed the project).
      if (payload.mode === 'run') {
        const runDir =
          lastBuildDir && (await pathExists(venvPython(lastBuildDir)))
            ? lastBuildDir
            : resolveBuildDir(pkgDir)
        const vpy = venvPython(runDir)
        if (!(await pathExists(vpy))) {
          appendOutput(
            'No build environment found. Click "Build Project" first to create the .venv, then Run.\n',
            getWindow,
          )
          return { ok: false, cwd: runDir, server: false }
        }
        if (!pkgDir) {
          appendOutput('Cannot determine the project entry module.\n', getWindow)
          return { ok: false, cwd: runDir, server: false }
        }
        // Sync the latest generated sources into the editable-installed project
        // so Run reflects the current canvas without a full rebuild.
        for (const [rel, content] of Object.entries(payload.files)) {
          const full = path.join(runDir, rel)
          await fs.mkdir(path.dirname(full), { recursive: true })
          await fs.writeFile(full, content, 'utf8')
        }
        // Replace any previously running server, then start detached so the IPC
        // call returns while the server keeps serving.
        stopServer(getWindow)
        appendOutput(`\nStarting server (venv): python -m ${pkgDir}.app.server\n`, getWindow)
        serverProcess = startServer(vpy, ['-m', `${pkgDir}.app.server`], runDir, getWindow)
        return { ok: true, cwd: runDir, server: true, pid: serverProcess.pid }
      }

      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'langtailor-run-'))
      for (const [rel, content] of Object.entries(payload.files)) {
        const full = path.join(tmp, rel)
        await fs.mkdir(path.dirname(full), { recursive: true })
        await fs.writeFile(full, content, 'utf8')
      }
      if (payload.mode === 'test') {
        // Prefer the Build venv's pytest so tests run against installed deps.
        const buildDir = lastBuildDir ?? resolveBuildDir(pkgDir)
        const vpy = venvPython(buildDir)
        const hasVenv = await pathExists(vpy)
        const hasTests = Object.keys(payload.files).some((f) => f.includes('/tests/'))
        const cwd = hasVenv ? buildDir : tmp
        const py = hasVenv ? `"${vpy}"` : 'python'
        const cmd = hasTests ? `${py} -m pytest -q` : 'echo No tests in project'
        const res = await runInOutput(cmd, cwd, getWindow)
        return { ...res, ok: res.exitCode === 0 }
      }
      if (payload.mode === 'debug') {
        const entry = mainPy ? path.join(tmp, mainPy) : path.join(tmp, 'run.py')
        if (!mainPy) {
          await fs.writeFile(entry, 'print("debug stub")\n', 'utf8')
        }
        getWindow()?.webContents.send('langtailor:debug', `Starting debugpy on ${entry}\n`)
        return { ok: true, cwd: tmp, program: entry }
      }
      return { ok: false }
    },
  )

  ipcMain.handle('langtailor:stop-run', async () => {
    const stopped = stopServer(getWindow)
    if (!stopped) appendOutput('No running server to stop.\n', getWindow)
    return { ok: true, stopped }
  })

  ipcMain.handle('langtailor:git-status', async (_e, cwd: string) => {
    return gitExec(['status', '--short', '-b'], cwd)
  })

  ipcMain.handle('langtailor:git-stage', async (_e, cwd: string, paths: string[]) => {
    await gitExec(['add', ...paths], cwd)
    return { ok: true }
  })

  ipcMain.handle('langtailor:git-commit', async (_e, cwd: string, message: string) => {
    await gitExec(['commit', '-m', message], cwd)
    return { ok: true }
  })

  ipcMain.handle('langtailor:get-output', () => outputLines.slice(-500))
}

function addRecent(p: string): void {
  // Keep the 10 most recent projects (most-recent first, de-duplicated).
  const recent = [p, ...getSettings().recentProjects.filter((r) => r !== p)].slice(0, 10)
  setSetting('recentProjects', recent)
}

/** Window title = workspace name — LangTailor (one window = one workspace). */
function applyWindowTitle(win: BrowserWindow | null, filePath: string): void {
  if (!win) return
  const name = path.basename(filePath).replace(/\.langstitch\.json$/i, '').replace(/\.json$/i, '')
  win.setTitle(`${name} — LangTailor`)
}

/**
 * Where a `build` writes its generated Python project. Prefer a `build/` folder
 * next to the saved `.langstitch.json` so the artifact sits beside the source;
 * fall back to `~/LangTailor/<project>/build` when the graph hasn't been saved.
 */
function resolveBuildDir(pkgDir?: string): string {
  const project = pkgDir || 'langtailor_project'
  const docPath = getCurrentDocPath()
  if (docPath) {
    return path.join(path.dirname(docPath), 'build', project)
  }
  return path.join(os.homedir(), 'LangTailor', project, 'build')
}

function runInOutput(
  command: string,
  cwd: string,
  getWindow: () => BrowserWindow | null,
  label?: string,
): Promise<{ exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(command, { cwd, shell: true })
    proc.stdout.on('data', (d) => appendOutput(d.toString(), getWindow))
    proc.stderr.on('data', (d) => appendOutput(d.toString(), getWindow))
    proc.on('close', (code) => {
      const tag = label ? `${label} ` : ''
      appendOutput(`\n[${tag}exit ${code}]\n`, getWindow)
      resolve({ exitCode: code })
    })
    proc.on('error', (err) => {
      appendOutput(`\n[${label ?? 'process'} error] ${err.message}\n`, getWindow)
      resolve({ exitCode: 1 })
    })
  })
}

/** Start a long-running process (the graph server) detached from the IPC call. */
function startServer(
  python: string,
  args: string[],
  cwd: string,
  getWindow: () => BrowserWindow | null,
): ChildProcess {
  const proc = spawn(python, args, { cwd, shell: false, windowsHide: true })
  proc.stdout?.on('data', (d) => appendOutput(d.toString(), getWindow))
  proc.stderr?.on('data', (d) => appendOutput(d.toString(), getWindow))
  proc.on('close', (code) => {
    appendOutput(`\n[server exited ${code}]\n`, getWindow)
    if (serverProcess && serverProcess.pid === proc.pid) serverProcess = null
  })
  proc.on('error', (err) => appendOutput(`\n[server error] ${err.message}\n`, getWindow))
  return proc
}

/** Kill the running graph server if any; returns whether one was stopped. */
function stopServer(getWindow: () => BrowserWindow | null): boolean {
  if (!serverProcess) return false
  appendOutput('\nStopping server…\n', getWindow)
  try {
    serverProcess.kill()
  } catch {
    /* already gone */
  }
  serverProcess = null
  return true
}

/** Remove generated sources from a build dir while preserving its ``.venv``. */
async function cleanSourcesPreservingVenv(outDir: string): Promise<void> {
  if (!(await pathExists(outDir))) return
  const entries = await fs.readdir(outDir)
  await Promise.all(
    entries
      .filter((e) => e !== '.venv')
      .map((e) => fs.rm(path.join(outDir, e), { recursive: true, force: true })),
  )
}

function appendOutput(line: string, getWindow: () => BrowserWindow | null): void {
  outputLines.push(line)
  if (outputLines.length > 2000) outputLines.splice(0, outputLines.length - 2000)
  getWindow()?.webContents.send('langtailor:output', line)
}

function gitExec(args: string[], cwd: string): Promise<{ branch?: string; lines: string[] }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, shell: true })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ lines: ['Not a git repository'] })
        return
      }
      const lines = out.trim().split('\n').filter(Boolean)
      const branchLine = lines.find((l) => l.startsWith('##'))
      const branch = branchLine?.split(' ')[0]?.replace('## ', '').split('...')[0]
      resolve({ branch, lines })
    })
    proc.on('error', reject)
  })
}

/** Kill the running graph server, if any (called on app shutdown). */
export function stopRunningServer(): void {
  if (!serverProcess) return
  try {
    serverProcess.kill()
  } catch {
    /* already gone */
  }
  serverProcess = null
}

export async function openFilePath(win: BrowserWindow, filePath: string): Promise<void> {
  const text = await fs.readFile(filePath, 'utf8')
  setDocPath(win.webContents.id, filePath)
  applyWindowTitle(win, filePath)
  win.webContents.send('host:init', { text, path: filePath })
  addRecent(filePath)
}
