import * as vscode from 'vscode'
import { clearToken, getToken, signIn } from './auth'
import { syncPlugins } from './sync'

const OUTPUT_NAME = 'LangStitch Marketplace'

function config<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration('langtailor.marketplace').get<T>(key, fallback)
}

function apiBaseUrl(): string {
  return config<string>('apiBaseUrl', 'https://langstitch.com')
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME)
  context.subscriptions.push(output)

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50)
  status.command = 'langtailor.marketplace.sync'
  context.subscriptions.push(status)

  const refreshStatus = async () => {
    const token = await getToken(context)
    if (token) {
      status.text = '$(extensions) LangStitch'
      status.tooltip = 'Sync your acquired LangStitch plugins'
    } else {
      status.text = '$(sign-in) LangStitch: Sign In'
      status.tooltip = 'Sign in to LangStitch to sync plugins'
      status.command = 'langtailor.marketplace.signIn'
    }
    status.show()
  }

  const runSync = async (silent: boolean) => {
    const token = await getToken(context)
    if (!token) {
      if (!silent) {
        const action = await vscode.window.showInformationMessage(
          'Sign in to LangStitch to sync your plugins.',
          'Sign In',
        )
        if (action === 'Sign In') await vscode.commands.executeCommand('langtailor.marketplace.signIn')
      }
      return
    }
    await syncPlugins(context, apiBaseUrl(), token, output, { silent })
    await refreshStatus()
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('langtailor.marketplace.signIn', async () => {
      const token = await signIn(context, apiBaseUrl())
      await refreshStatus()
      if (token) {
        void vscode.window.showInformationMessage('Signed in to LangStitch.')
        await runSync(false)
      } else {
        void vscode.window.showWarningMessage('LangStitch sign-in was cancelled or failed.')
      }
    }),
    vscode.commands.registerCommand('langtailor.marketplace.signOut', async () => {
      await clearToken(context)
      await refreshStatus()
      void vscode.window.showInformationMessage('Signed out of LangStitch.')
    }),
    vscode.commands.registerCommand('langtailor.marketplace.sync', () => runSync(false)),
    vscode.commands.registerCommand('langtailor.marketplace.openPortal', () => {
      void vscode.env.openExternal(vscode.Uri.parse(apiBaseUrl().replace(/\/+$/, '')))
    }),
  )

  void refreshStatus()

  if (config<boolean>('autoSync', true)) {
    void runSync(true)
  }
}

export function deactivate(): void {
  /* no-op */
}
