import * as vscode from 'vscode'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { downloadFile, getJson } from './http'
import { compareVersions } from './semver'
import { clearToken } from './auth'

export interface SyncItem {
  slug: string
  extension_id: string
  name: string
  kind: string
  source: string
  pinned: boolean
  target_version: string
  download_url: string
  sha256?: string | null
  min_ide_version?: string | null
}

interface SyncOptions {
  silent?: boolean
}

/**
 * Reconcile the locally installed extensions with the user's acquired plugins.
 *
 * Installs anything missing and updates anything older than the target version.
 * ``silent`` suppresses "already up to date" chatter (used for startup auto-sync).
 */
export async function syncPlugins(
  context: vscode.ExtensionContext,
  apiBaseUrl: string,
  token: string,
  output: vscode.OutputChannel,
  options: SyncOptions = {},
): Promise<void> {
  const base = apiBaseUrl.replace(/\/+$/, '')
  output.appendLine(`[${new Date().toISOString()}] Syncing acquired plugins…`)

  let manifest: { plugins: SyncItem[] }
  try {
    manifest = await getJson<{ plugins: SyncItem[] }>(`${base}/api/marketplace/sync`, token)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    output.appendLine(`Sync failed: ${message}`)
    if (message.startsWith('HTTP 401')) {
      await clearToken(context)
      const action = await vscode.window.showWarningMessage(
        'Your LangStitch session expired. Sign in again to sync plugins.',
        'Sign In',
      )
      if (action === 'Sign In') {
        await vscode.commands.executeCommand('langtailor.marketplace.signIn')
      }
      return
    }
    if (!options.silent) {
      void vscode.window.showErrorMessage(`LangStitch sync failed: ${message}`)
    }
    return
  }

  const toInstall = manifest.plugins.filter((item) => {
    const installed = vscode.extensions.getExtension(item.extension_id)
    if (!installed) {
      output.appendLine(`  • ${item.extension_id}: not installed → install ${item.target_version}`)
      return true
    }
    const current = String(installed.packageJSON?.version ?? '0.0.0')
    if (compareVersions(current, item.target_version) < 0) {
      output.appendLine(`  • ${item.extension_id}: ${current} → ${item.target_version}`)
      return true
    }
    output.appendLine(`  • ${item.extension_id}: up to date (${current})`)
    return false
  })

  if (toInstall.length === 0) {
    output.appendLine('All acquired plugins are up to date.')
    if (!options.silent) {
      void vscode.window.showInformationMessage('LangStitch: all plugins are up to date.')
    }
    return
  }

  let installedCount = 0
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'LangStitch: installing plugins', cancellable: false },
    async (progress) => {
      for (const item of toInstall) {
        progress.report({ message: `${item.name} v${item.target_version}` })
        try {
          await installVsix(item, output)
          installedCount += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          output.appendLine(`  ✗ ${item.extension_id} failed: ${message}`)
          void vscode.window.showErrorMessage(`Failed to install ${item.name}: ${message}`)
        }
      }
    },
  )

  if (installedCount > 0) {
    const reload = await vscode.window.showInformationMessage(
      `LangStitch installed/updated ${installedCount} plugin${installedCount === 1 ? '' : 's'}.`,
      'Reload Window',
    )
    if (reload === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow')
    }
  }
}

async function installVsix(item: SyncItem, output: vscode.OutputChannel): Promise<void> {
  const safe = item.extension_id.replace(/[^a-zA-Z0-9._-]/g, '_')
  const tmp = path.join(os.tmpdir(), `${safe}-${item.target_version}.vsix`)
  output.appendLine(`    downloading ${item.download_url}`)
  // Download URLs point at public hosts (Open VSX / our CDN); no token sent.
  await downloadFile(item.download_url, tmp)
  output.appendLine(`    installing ${tmp}`)
  await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmp))
  try {
    fs.unlinkSync(tmp)
  } catch {
    /* best-effort cleanup */
  }
}
