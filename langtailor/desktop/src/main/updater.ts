import electronUpdater from 'electron-updater'
import { app } from 'electron'

const { autoUpdater } = electronUpdater
export function initAutoUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    /* offline or no release */
  })
}
