import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  protocol,
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerCommandHandlers, openFilePath, stopRunningServer, clearDocPath } from './commands.js'
import { registerSidecarHandlers } from './sidecars.js'
import { buildMenu } from './menu.js'
import { initAutoUpdater } from './updater.js'
import { registerPluginHandlers } from './plugins.js'
import { registerTerminalHandlers } from './terminal.js'
import { registerWebviewBridge } from './bridge.js'
import { startPlatformServer, stopPlatformServer, platformApiBase } from './platformServer.js'
import { createSplashWindow, setSplashStatus } from './splash.js'
import {
  registerAuthHandlers,
  handleAuthDeepLink,
  extractDeepLink,
} from './authBridge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
// One IDE window = one workspace. Track every open window; route host actions to
// whichever window is focused so output/terminal/menu hit the right workspace.
const windows = new Set<BrowserWindow>()
const focusedWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? mainWindow ?? [...windows][0] ?? null
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const gotLock = app.requestSingleInstanceLock()
const DESKTOP_SCHEME = 'langtailor'

if (!gotLock) {
  app.quit()
} else {
  // Register langtailor:// so OAuth can redirect back with a bearer token.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DESKTOP_SCHEME, process.execPath, [
        path.resolve(process.argv[1]),
      ])
    }
  } else {
    app.setAsDefaultProtocolClient(DESKTOP_SCHEME)
  }

  app.on('second-instance', (_e, argv) => {
    const deepLink = extractDeepLink(argv)
    if (deepLink) handleAuthDeepLink(deepLink, focusedWindow)
    const file = argv.find((a) => a.endsWith('.langstitch.json'))
    const target = focusedWindow()
    if (target && file) void openFilePath(target, file)
    target?.focus()
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthDeepLink(url, focusedWindow)
  })

  app.whenReady().then(async () => {
    // IntelliJ-style splash: show product/company/version and stream the
    // startup sequence while services boot, then hand off to the main window.
    const splashStartedAt = Date.now()
    splashWindow = createSplashWindow(app.getVersion())

    protocol.handle('langtailor', (req) => {
      const url = new URL(req.url)
      return new Response(`LangTailor protocol: ${url.hostname}`)
    })

    setSplashStatus(splashWindow, 'Loading core components…')
    registerCommandHandlers(focusedWindow)
    registerSidecarHandlers(focusedWindow)
    registerTerminalHandlers(focusedWindow)
    registerPluginHandlers()
    registerWebviewBridge(focusedWindow)
    registerAuthHandlers(focusedWindow)
    ipcMain.handle('langtailor:open-external', async (_e, url: string) => {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        await shell.openExternal(url)
        return { ok: true }
      }
      return { ok: false, error: 'Only http(s) URLs can be opened externally.' }
    })
    ipcMain.handle('langtailor:platform-api-base', async () => platformApiBase())
    // Renderer reports its workspace name so the OS window title stays in sync.
    ipcMain.handle('langtailor:set-title', (e, name: string) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (win) win.setTitle(name ? `${name} — LangTailor` : 'LangTailor')
      return { ok: true }
    })
    // Open a fresh IDE window (a new, empty workspace).
    ipcMain.handle('langtailor:new-window', () => {
      createWindow()
      return { ok: true }
    })
    // Native File → New Window routes here.
    ipcMain.on('menu:new-window', () => {
      createWindow()
    })

    setSplashStatus(splashWindow, 'Starting platform services…')
    await startPlatformServer().then(({ ok, base }) => {
      if (!ok) console.warn('[langtailor] Platform API sidecar did not start — marketplace auth may be unavailable.')
      else console.info('[langtailor] Platform API at', base)
    })

    setSplashStatus(splashWindow, 'Validating license…')
    await delay(250)
    setSplashStatus(splashWindow, 'Preparing workspace…')

    createWindow()
    const deepLink = extractDeepLink(process.argv)
    if (deepLink) handleAuthDeepLink(deepLink, focusedWindow)
    initAutoUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // Swap splash → main window once the renderer is painted (min 1.2s so the
    // splash doesn't just flash on fast machines).
    const reveal = () => {
      if (!mainWindow || mainWindow.isVisible()) return
      mainWindow.show()
      mainWindow.focus()
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
      splashWindow = null
    }
    mainWindow?.once('ready-to-show', () => {
      const wait = Math.max(0, 1200 - (Date.now() - splashStartedAt))
      setTimeout(reveal, wait)
    })
    // Safety net in case ready-to-show is delayed/missed.
    setTimeout(reveal, 8000)
  })

  app.on('open-file', (e, filePath) => {
    e.preventDefault()
    const target = focusedWindow()
    if (target) void openFilePath(target, filePath)
  })

  app.on('window-all-closed', () => {
    stopRunningServer()
    stopPlatformServer()
    if (process.platform !== 'darwin') app.quit()
  })
}

function createWindow(): BrowserWindow {
  // The first window pairs with the splash (shown on handoff); later windows
  // (File → New Window) show themselves as soon as they're painted.
  const isFirst = windows.size === 0
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'LangTailor',
    show: false,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  windows.add(win)
  if (isFirst) mainWindow = win
  const wcId = win.webContents.id

  const rendererHtml = path.join(__dirname, '../../renderer-dist/index.html')
  void win.loadFile(rendererHtml)

  if (!isFirst) {
    win.once('ready-to-show', () => {
      win.show()
      win.focus()
    })
  }

  win.on('closed', () => {
    windows.delete(win)
    clearDocPath(wcId)
    if (mainWindow === win) mainWindow = [...windows][0] ?? null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Never let the renderer navigate away from the bundled app (e.g. an OAuth
  // redirect to /api/... would resolve to a broken file:// URL and blank the
  // window). Send any http(s) navigation to the system browser instead.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  Menu.setApplicationMenu(buildMenu(win))

  const fileArg = process.argv.find((a) => a.endsWith('.langstitch.json'))
  if (isFirst && fileArg) void openFilePath(win, fileArg)
  return win
}
