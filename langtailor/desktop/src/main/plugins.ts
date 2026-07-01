import { ipcMain, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface PluginManifest {
  id: string
  name: string
  version: string
  contributes?: {
    commands?: Array<{ id: string; title: string }>
    components?: unknown[]
    themes?: unknown[]
  }
}

const pluginsDir = () => path.join(app.getPath('userData'), 'plugins')

export function registerPluginHandlers(): void {
  ipcMain.handle('langtailor:plugins-list', async () => {
    const dir = pluginsDir()
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const manifests: PluginManifest[] = []
      for (const e of entries) {
        if (!e.isDirectory()) continue
        try {
          const raw = await fs.readFile(path.join(dir, e.name, 'plugin.json'), 'utf8')
          manifests.push(JSON.parse(raw) as PluginManifest)
        } catch {
          /* skip invalid */
        }
      }
      return manifests
    } catch {
      return []
    }
  })

  ipcMain.handle('langtailor:plugins-install', async (_e, manifest: PluginManifest) => {
    const dir = path.join(pluginsDir(), manifest.id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf8')
    return { ok: true }
  })
}
