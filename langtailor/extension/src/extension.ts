import * as vscode from 'vscode'

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
}

export function deactivate(): void {
  /* no-op */
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
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media')
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    }
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview)

    // Guard so edits the webview pushes back don't bounce back as updates.
    let savingFromWebview = false

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return
      if (savingFromWebview) return
      webviewPanel.webview.postMessage({ type: 'update', text: document.getText() })
    })

    const msgSub = webviewPanel.webview.onDidReceiveMessage(async (msg: { type: string; text?: string }) => {
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

function makeNonce(): string {
  let text = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length))
  return text
}
