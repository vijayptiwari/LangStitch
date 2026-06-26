import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

const VIEW_TYPE = 'langtailor.canvas'

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

type ExportFormat = 'python' | 'spring' | 'full'

interface WebviewRequest {
  type: string
  requestId: string
  format?: ExportFormat
  zip?: Uint8Array
  version?: string
  imageFormat?: 'jpeg' | 'png'
  dataUrl?: string
}

interface WebviewResponse {
  type: string
  requestId: string
  zip?: Uint8Array
  files?: Record<string, string>
  projectJson?: string
  error?: string
  graphName?: string
  projectVersion?: string
  dataUrl?: string
}

/** Tracks the active canvas webview panel per document URI. */
const activePanels = new Map<string, vscode.WebviewPanel>()
const pendingRequests = new Map<
  string,
  { resolve: (msg: WebviewResponse) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }
>()

function makeNonce(): string {
  let text = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length))
  return text
}

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('langtailor')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'graph'
}

function getActiveCanvasPanel(): { panel: vscode.WebviewPanel; document: vscode.TextDocument } | null {
  const editor = vscode.window.activeTextEditor
  if (editor?.document.fileName.endsWith('.langstitch.json')) {
    const panel = activePanels.get(editor.document.uri.toString())
    if (panel) return { panel, document: editor.document }
  }
  for (const [uri, panel] of activePanels) {
    if (panel.active) {
      const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri)
      if (doc) return { panel, document: doc }
    }
  }
  return null
}

async function requireCanvas(): Promise<{ panel: vscode.WebviewPanel; document: vscode.TextDocument }> {
  const active = getActiveCanvasPanel()
  if (active) return active
  const pick = await vscode.window.showQuickPick(
  ['Open an existing graph', 'Create a new graph'],
    { placeHolder: 'No active LangTailor canvas — choose an action' },
  )
  if (pick === 'Create a new graph') {
    await vscode.commands.executeCommand('langtailor.newGraph')
    const retry = getActiveCanvasPanel()
    if (retry) return retry
  } else if (pick === 'Open an existing graph') {
    await vscode.commands.executeCommand('langtailor.openProject')
    const retry = getActiveCanvasPanel()
    if (retry) return retry
  }
  throw new Error('No active LangTailor canvas editor')
}

function postMessageWithResponse<T extends WebviewResponse>(
  panel: vscode.WebviewPanel,
  msg: Omit<WebviewRequest, 'requestId'>,
  timeoutMs = 60_000,
): Promise<T> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Webview request timed out: ${msg.type}`))
    }, timeoutMs)
    pendingRequests.set(requestId, {
      resolve: resolve as (msg: WebviewResponse) => void,
      reject,
      timer,
    })
    void panel.webview.postMessage({ ...msg, requestId })
  })
}

function handleWebviewResponse(msg: WebviewResponse): void {
  const pending = pendingRequests.get(msg.requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingRequests.delete(msg.requestId)
  if (msg.error) pending.reject(new Error(msg.error))
  else pending.resolve(msg)
}

function resolveOutputDir(context: vscode.ExtensionContext, docUri: vscode.Uri): vscode.Uri {
  const cfg = getConfig()
  const raw = cfg.get<string>('outputDir', '${workspaceFolder}/build') ?? '${workspaceFolder}/build'
  const wsFolder = vscode.workspace.getWorkspaceFolder(docUri)
  const expanded = raw.replace(/\$\{workspaceFolder\}/g, wsFolder?.uri.fsPath ?? path.dirname(docUri.fsPath))
  const persisted = context.workspaceState.get<string>(`outputDir:${docUri.toString()}`)
  const dirPath = persisted ?? expanded
  return vscode.Uri.file(dirPath)
}

function persistOutputDir(context: vscode.ExtensionContext, docUri: vscode.Uri, dir: vscode.Uri): void {
  void context.workspaceState.update(`outputDir:${docUri.toString()}`, dir.fsPath)
}

async function writeBuildFiles(
  projectDir: vscode.Uri,
  files: Record<string, string>,
): Promise<void> {
  const preserve = new Set(['.venv', 'node_modules', '.git'])
  const generatedPaths = new Set(Object.keys(files))

  for (const [relPath, content] of Object.entries(files)) {
    const uri = vscode.Uri.joinPath(projectDir, relPath)
    const parent = vscode.Uri.file(path.dirname(uri.fsPath))
    await vscode.workspace.fs.createDirectory(parent)
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'))
  }

  try {
    const entries = await vscode.workspace.fs.readDirectory(projectDir)
    for (const [name, type] of entries) {
      if (preserve.has(name)) continue
      if (type !== vscode.FileType.File) continue
      const rel = name
      if (!generatedPaths.has(rel) && !rel.startsWith('.')) {
        const uri = vscode.Uri.joinPath(projectDir, rel)
        try {
          await vscode.workspace.fs.delete(uri)
        } catch {
          /* user file — skip */
        }
      }
    }
  } catch {
    /* directory may not exist yet */
  }
}

async function compileProject(projectDir: vscode.Uri, pythonPath: string): Promise<void> {
  const cwd = projectDir.fsPath
  const task = new vscode.Task(
    { type: 'shell' },
    vscode.TaskScope.Workspace,
    'LangTailor Build',
    'langtailor',
    new vscode.ShellExecution(
      `"${pythonPath}" -m pip install -e ".[dev]" && "${pythonPath}" -m compileall . && "${pythonPath}" -m langstitch info`,
      { cwd },
    ),
  )
  const exec = await vscode.tasks.executeTask(task)
  return new Promise((resolve, reject) => {
    const sub = vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.execution === exec) {
        sub.dispose()
        if (e.exitCode === 0) resolve()
        else reject(new Error(`Build compile failed (exit ${e.exitCode})`))
      }
    })
  })
}

function parseGraphMeta(text: string): { name: string; version: string } {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    const doc = (raw.document ?? raw) as Record<string, unknown>
    return {
      name: String(doc.name ?? 'my_graph'),
      version: String(doc.projectVersion ?? '0.1.0'),
    }
  } catch {
    return { name: 'my_graph', version: '0.1.0' }
  }
}

async function ensureBuilt(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument,
): Promise<vscode.Uri> {
  const projectDir = resolveOutputDir(context, document.uri)
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(projectDir, 'pyproject.toml'))
    return projectDir
  } catch {
    await vscode.commands.executeCommand('langtailor.build')
    return resolveOutputDir(context, document.uri)
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(LangTailorCanvasProvider.register(context))

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.newGraph', async () => {
      const folders = vscode.workspace.workspaceFolders
      const target = await vscode.window.showInputBox({
        prompt: 'New graph file name',
        value: 'my_graph.langstitch.json',
      })
      if (!target) return
      const base = folders?.[0]?.uri ?? vscode.Uri.file(target)
      const uri = folders ? vscode.Uri.joinPath(base, target) : base
      await vscode.workspace.fs.writeFile(uri, Buffer.from(STARTER_GRAPH, 'utf8'))
      await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.openProject', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        filters: { LangStitch: ['langstitch.json', 'zip', 'json'], Archives: ['zip'] },
        openLabel: 'Open',
      })
      if (!picked?.[0]) return
      const uri = picked[0]
      const stat = await vscode.workspace.fs.stat(uri)

      if (stat.type === vscode.FileType.File && uri.fsPath.endsWith('.langstitch.json')) {
        await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE)
        return
      }

      if (stat.type === vscode.FileType.File && uri.fsPath.endsWith('.zip')) {
        const bytes = await vscode.workspace.fs.readFile(uri)
        const active = getActiveCanvasPanel()
        if (!active) {
          void vscode.window.showErrorMessage(
            'Open any LangTailor graph first, then use Open Project to import a .zip',
          )
          return
        }
        const res = await postMessageWithResponse(active.panel, {
          type: 'unzipProject',
          zip: bytes,
        })
        if (!res.projectJson) throw new Error('Could not extract project from zip')
        const projectJson = res.projectJson
        const meta = JSON.parse(projectJson) as Record<string, unknown>
        const doc = (meta.document ?? meta) as Record<string, unknown>
        const name = String(doc.name ?? 'imported_graph')
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(path.dirname(uri.fsPath))
        const outUri = vscode.Uri.joinPath(ws, `${slugify(name)}.langstitch.json`)
        const wrapped = JSON.stringify({ document: doc, ...meta }, null, 2)
        await vscode.workspace.fs.writeFile(outUri, Buffer.from(wrapped, 'utf8'))
        await vscode.commands.executeCommand('vscode.openWith', outUri, VIEW_TYPE)
        return
      }

      if (stat.type === vscode.FileType.Directory) {
        const candidates = ['langstitch.project.json', 'langsmith.json']
        let projectJson: string | undefined
        for (const c of candidates) {
          try {
            const f = vscode.Uri.joinPath(uri, c)
            const buf = await vscode.workspace.fs.readFile(f)
            projectJson = Buffer.from(buf).toString('utf8')
            break
          } catch {
            /* try next */
          }
        }
        if (!projectJson) {
          void vscode.window.showErrorMessage('No langstitch.project.json or langsmith.json found in folder')
          return
        }
        const meta = JSON.parse(projectJson) as Record<string, unknown>
        const doc = (meta.document ?? meta) as Record<string, unknown>
        const name = String(doc.name ?? path.basename(uri.fsPath))
        const outUri = vscode.Uri.joinPath(uri, `${slugify(name)}.langstitch.json`)
        const wrapped = JSON.stringify({ document: doc, ...meta }, null, 2)
        await vscode.workspace.fs.writeFile(outUri, Buffer.from(wrapped, 'utf8'))
        await vscode.commands.executeCommand('vscode.openWith', outUri, VIEW_TYPE)
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.export', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: 'Python project', value: 'python' as ExportFormat },
          { label: 'Spring Boot gateway', value: 'spring' as ExportFormat },
          { label: 'Full bundle (Python + Spring + Docker)', value: 'full' as ExportFormat },
          { label: 'Diagram (JPEG)', value: 'image-jpeg' as const },
          { label: 'Diagram (PNG)', value: 'image-png' as const },
        ],
        { placeHolder: 'Export format' },
      )
      if (!choice) return

      const { panel, document } = await requireCanvas()
      const meta = parseGraphMeta(document.getText())

      if (choice.value === 'image-jpeg' || choice.value === 'image-png') {
        const fmt = choice.value === 'image-jpeg' ? 'jpeg' : 'png'
        const res = await postMessageWithResponse(panel, { type: 'requestExportImage', imageFormat: fmt })
        if (!res.dataUrl) throw new Error('Image export failed')
        const ext = fmt === 'jpeg' ? 'jpg' : 'png'
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${slugify(meta.name)}.${ext}`),
          filters: { Images: [ext] },
        })
        if (!saveUri) return
        const base64 = res.dataUrl.replace(/^data:image\/\w+;base64,/, '')
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(base64, 'base64'))
        void vscode.window.showInformationMessage(`Diagram saved to ${saveUri.fsPath}`)
        return
      }

      const res = await postMessageWithResponse(panel, {
        type: 'requestExport',
        format: choice.value as ExportFormat,
      })
      if (!res.zip) throw new Error('Export failed — no zip returned')
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${slugify(meta.name)}.zip`),
        filters: { Archives: ['zip'] },
      })
      if (!saveUri) return
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(res.zip))
      void vscode.window.showInformationMessage(`Exported to ${saveUri.fsPath}`)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.build', async () => {
      const { panel, document } = await requireCanvas()
      const res = await postMessageWithResponse(panel, { type: 'requestBuild', format: 'full' })
      if (!res.files) throw new Error('Build failed — no files returned')

      let projectDir = resolveOutputDir(context, document.uri)
      const pick = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        openLabel: 'Select build output folder',
        defaultUri: projectDir,
      })
      if (pick?.[0]) projectDir = pick[0]
      persistOutputDir(context, document.uri, projectDir)

      await vscode.workspace.fs.createDirectory(projectDir)
      await writeBuildFiles(projectDir, res.files)

      const pythonPath = getConfig().get<string>('pythonPath', 'python') ?? 'python'
      try {
        await compileProject(projectDir, pythonPath)
        void vscode.window.showInformationMessage(`Build complete: ${projectDir.fsPath}`)
      } catch (e) {
        void vscode.window.showWarningMessage(
          `Project scaffolded at ${projectDir.fsPath}, but compile step failed: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.run', async () => {
      const { panel, document } = await requireCanvas()
      const projectDir = await ensureBuilt(context, panel, document)
      const pythonPath = getConfig().get<string>('pythonPath', 'python') ?? 'python'
      const port = getConfig().get<number>('serverPort', 8000) ?? 8000
      const term = vscode.window.createTerminal({
        name: 'LangTailor Run',
        cwd: projectDir.fsPath,
      })
      term.show()
      term.sendText(`"${pythonPath}" -m langstitch run --port ${port}`)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.test', async () => {
      const { panel, document } = await requireCanvas()
      const projectDir = await ensureBuilt(context, panel, document)
      const pythonPath = getConfig().get<string>('pythonPath', 'python') ?? 'python'
      const meta = parseGraphMeta(document.getText())
      const pkg = slugify(meta.name)
      const term = vscode.window.createTerminal({
        name: 'LangTailor Test',
        cwd: projectDir.fsPath,
      })
      term.show()
      term.sendText(`"${pythonPath}" -m ${pkg}.eval_runner`)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.package', async () => {
      const { panel, document } = await requireCanvas()
      const projectDir = await ensureBuilt(context, panel, document)
      const pythonPath = getConfig().get<string>('pythonPath', 'python') ?? 'python'
      const meta = parseGraphMeta(document.getText())
      const slug = slugify(meta.name)
      const distDir = path.join(projectDir.fsPath, 'dist')
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(distDir))

      const term = vscode.window.createTerminal({
        name: 'LangTailor Package',
        cwd: projectDir.fsPath,
      })
      term.show()
      term.sendText(`"${pythonPath}" -m pip install build -q && "${pythonPath}" -m build --wheel`)
      const helmChart = path.join(projectDir.fsPath, 'deploy', 'helm', slug)
      if (fs.existsSync(helmChart)) {
        term.sendText(`helm package deploy/helm/${slug} -d dist 2>/dev/null || (cd deploy/helm/${slug} && zip -r ../../dist/${slug}-${meta.version}-chart.zip .)`)
      }
      void vscode.window.showInformationMessage(`Packaging started — see terminal. Output: ${distDir}`)
      await vscode.commands.executeCommand('revealFileInExplorer', vscode.Uri.file(distDir))
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.version', async () => {
      const { panel, document } = await requireCanvas()
      const meta = parseGraphMeta(document.getText())
      const current = meta.version
      const choice = await vscode.window.showQuickPick(
        [
          { label: `Patch (${bumpSemver(current, 'patch')})`, value: 'patch' },
          { label: `Minor (${bumpSemver(current, 'minor')})`, value: 'minor' },
          { label: `Major (${bumpSemver(current, 'major')})`, value: 'major' },
          { label: 'Custom…', value: 'custom' },
        ],
        { placeHolder: `Current version: ${current}` },
      )
      if (!choice) return
      let next = current
      if (choice.value === 'custom') {
        const custom = await vscode.window.showInputBox({
          prompt: 'Enter version',
          value: current,
          validateInput: (v) => (/^\d+\.\d+\.\d+/.test(v) ? null : 'Use semver x.y.z'),
        })
        if (!custom) return
        next = custom
      } else {
        next = bumpSemver(current, choice.value as 'patch' | 'minor' | 'major')
      }
      await postMessageWithResponse(panel, { type: 'setVersion', version: next })

      const projectDir = resolveOutputDir(context, document.uri)
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(projectDir, 'pyproject.toml'))
        await patchVersionInProject(projectDir, next, slugify(meta.name))
      } catch {
        /* not built yet */
      }
      void vscode.window.showInformationMessage(`Version set to ${next}`)
    }),
  )
}

function bumpSemver(v: string, kind: 'patch' | 'minor' | 'major'): string {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return '0.1.0'
  let major = parseInt(m[1], 10)
  let minor = parseInt(m[2], 10)
  let patch = parseInt(m[3], 10)
  if (kind === 'major') { major++; minor = 0; patch = 0 }
  else if (kind === 'minor') { minor++; patch = 0 }
  else patch++
  return `${major}.${minor}.${patch}`
}

async function patchVersionInProject(dir: vscode.Uri, version: string, slug: string): Promise<void> {
  const files = ['pyproject.toml', 'langsmith.json', path.join('deploy', 'helm', slug, 'Chart.yaml')]
  for (const rel of files) {
    try {
      const uri = vscode.Uri.joinPath(dir, rel)
      let text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
      text = text.replace(/version\s*=\s*"[^"]+"/g, `version = "${version}"`)
      text = text.replace(/^version:\s*.+$/m, `version: ${version}`)
      text = text.replace(/^appVersion:\s*.+$/m, `appVersion: ${version}`)
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'))
    } catch {
      /* optional file */
    }
  }
}

export function deactivate(): void {
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Extension deactivated'))
  }
  pendingRequests.clear()
  activePanels.clear()
}

class LangTailorCanvasProvider implements vscode.CustomTextEditorProvider {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      new LangTailorCanvasProvider(context),
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false },
    )
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    const docKey = document.uri.toString()
    activePanels.set(docKey, webviewPanel)
    webviewPanel.onDidDispose(() => activePanels.delete(docKey))

    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media')
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    }
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview)

    let savingFromWebview = false

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return
      if (savingFromWebview) return
      webviewPanel.webview.postMessage({ type: 'update', text: document.getText() })
    })

    const msgSub = webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewResponse & { type: string; text?: string; requestId?: string }) => {
      if (msg.requestId && (
        msg.type === 'exportResult' ||
        msg.type === 'buildResult' ||
        msg.type === 'unzipResult' ||
        msg.type === 'setVersionResult' ||
        msg.type === 'exportImageResult'
      )) {
        handleWebviewResponse(msg)
        return
      }
      if (msg.type === 'ready') {
        webviewPanel.webview.postMessage({ type: 'init', text: document.getText() })
      } else if (msg.type === 'edit' && typeof msg.text === 'string') {
        savingFromWebview = true
        await this.applyFullText(document, msg.text)
        savingFromWebview = false
      }
    })

    webviewPanel.onDidDispose(() => {
      changeSub.dispose()
      msgSub.dispose()
    })
  }

  private applyFullText(document: vscode.TextDocument, text: string): Thenable<boolean> {
    if (document.getText() === text) return Promise.resolve(true)
    const edit = new vscode.WorkspaceEdit()
    const fullRange = new vscode.Range(
      0,
      0,
      document.lineCount,
      document.lineAt(Math.max(document.lineCount - 1, 0)).text.length,
    )
    edit.replace(document.uri, fullRange, text)
    return vscode.workspace.applyEdit(edit)
  }

  private getHtml(webview: vscode.Webview): string {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media')
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'webview.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'webview.css'))
    const nonce = makeNonce()
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src ${webview.cspSource} https://fonts.gstatic.com`,
      `script-src 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource}`,
    ].join('; ')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>LangTailor Canvas</title>
  <style>html,body,#root{height:100%;margin:0;padding:0;}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }
}
