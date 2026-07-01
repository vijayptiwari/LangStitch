import { app, dialog, Menu, shell, type BrowserWindow, ipcMain } from 'electron'

export function buildMenu(win: BrowserWindow): Menu {
  const send = (channel: string) => () => win.webContents.send(channel)

  const showAbout = () => {
    void dialog.showMessageBox(win, {
      type: 'info',
      title: 'About LangTailor',
      message: 'LangTailor',
      detail: [
        `Visual LangGraph IDE`,
        `Version ${app.getVersion()}`,
        `Electron ${process.versions.electron}`,
        `Chromium ${process.versions.chrome}`,
        `Node ${process.versions.node}`,
        '',
        'https://langtailor.langstitch.com',
      ].join('\n'),
      buttons: ['OK'],
    })
  }

  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New Graph', accelerator: 'CmdOrCtrl+N', click: send('menu:new-graph') },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => ipcMain.emit('menu:new-window'),
        },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: send('menu:open-project') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('menu:save') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Canvas View', accelerator: 'CmdOrCtrl+1', click: send('menu:view-canvas') },
        { label: 'Code View', accelerator: 'CmdOrCtrl+2', click: send('menu:view-code') },
        { type: 'separator' },
        { label: 'Command Palette', accelerator: 'CmdOrCtrl+Shift+P', click: send('menu:command-palette') },
        { label: 'Quick Open', accelerator: 'CmdOrCtrl+P', click: send('menu:quick-open') },
        { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+`', click: send('menu:terminal') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Project',
      submenu: [
        { label: 'Build', accelerator: 'CmdOrCtrl+Shift+B', click: send('menu:build') },
        { label: 'Run', accelerator: 'F5', click: send('menu:run') },
        { label: 'Debug', accelerator: 'CmdOrCtrl+Shift+D', click: send('menu:debug') },
        { label: 'Test', click: send('menu:test') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+Shift+E', click: send('menu:export') },
        { label: 'Version History', click: send('menu:version') },
        { type: 'separator' },
        { label: 'Project Settings…', accelerator: 'CmdOrCtrl+,', click: send('menu:settings') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => void shell.openExternal('https://langstitch.com/docs/'),
        },
        { type: 'separator' },
        { label: 'About LangTailor', click: showAbout },
      ],
    },
  ])
}
