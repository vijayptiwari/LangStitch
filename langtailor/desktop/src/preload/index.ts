import { contextBridge, ipcRenderer } from 'electron'



type VsCodeMessage = Record<string, unknown>



function postMessage(message: VsCodeMessage): void {

  ipcRenderer.send('webview:message', message)

}



ipcRenderer.on('host:message', (_e, msg: VsCodeMessage) => {

  window.postMessage(msg, '*')

})



ipcRenderer.on('host:init', (_e, msg: VsCodeMessage) => {

  window.postMessage({ type: 'init', ...msg }, '*')

})



ipcRenderer.on('menu:view-canvas', () => {

  window.postMessage({ type: 'menu', action: 'view-canvas' }, '*')

})

ipcRenderer.on('menu:view-code', () => {

  window.postMessage({ type: 'menu', action: 'view-code' }, '*')

})

ipcRenderer.on('menu:command-palette', () => {

  window.postMessage({ type: 'menu', action: 'command-palette' }, '*')

})

ipcRenderer.on('menu:quick-open', () => {

  window.postMessage({ type: 'menu', action: 'quick-open' }, '*')

})

ipcRenderer.on('menu:terminal', () => {

  window.postMessage({ type: 'menu', action: 'terminal' }, '*')

})

ipcRenderer.on('menu:save', () => {

  window.postMessage({ type: 'menu', action: 'save' }, '*')

})

ipcRenderer.on('menu:build', () => {

  window.postMessage({ type: 'menu', action: 'build' }, '*')

})

ipcRenderer.on('menu:run', () => {

  window.postMessage({ type: 'menu', action: 'run' }, '*')

})

ipcRenderer.on('menu:debug', () => {

  window.postMessage({ type: 'menu', action: 'debug' }, '*')

})

ipcRenderer.on('menu:test', () => {

  window.postMessage({ type: 'menu', action: 'test' }, '*')

})

ipcRenderer.on('menu:export', () => {

  window.postMessage({ type: 'menu', action: 'export' }, '*')

})

ipcRenderer.on('menu:version', () => {

  window.postMessage({ type: 'menu', action: 'version' }, '*')

})

ipcRenderer.on('menu:settings', () => {

  window.postMessage({ type: 'menu', action: 'settings' }, '*')

})

ipcRenderer.on('menu:new-graph', () => {

  window.postMessage({ type: 'menu', action: 'new-graph' }, '*')

})

ipcRenderer.on('menu:open-project', () => {

  window.postMessage({ type: 'menu', action: 'open-project' }, '*')

})



window.addEventListener('message', (event) => {

  const msg = event.data as VsCodeMessage

  if (msg?.type === 'ready' || msg?.type === 'edit' || msg?.requestId) {

    ipcRenderer.send('webview:message', msg)

  }

})



contextBridge.exposeInMainWorld('acquireVsCodeApi', () => ({

  postMessage,

  getState: () => null,

  setState: () => {},

}))



contextBridge.exposeInMainWorld('langtailor', {

  isElectron: true,

  openExternal: (url: string) => ipcRenderer.invoke('langtailor:open-external', url),

  getPlatformApiBase: () => ipcRenderer.invoke('langtailor:platform-api-base') as Promise<string>,

  getAuthToken: () =>
    ipcRenderer.invoke('langtailor:get-auth-token') as Promise<{ token: string | null }>,

  setAuthToken: (token: string | null) =>
    ipcRenderer.invoke('langtailor:set-auth-token', token) as Promise<{ ok: boolean }>,

  onAuthToken: (cb: (token: string | null) => void) => {
    const handler = (_e: unknown, token: string | null) => cb(token)
    ipcRenderer.on('langtailor:auth-token', handler)
    return () => ipcRenderer.removeListener('langtailor:auth-token', handler)
  },

  onAuthError: (cb: (error: string) => void) => {
    const handler = (_e: unknown, error: string) => cb(error)
    ipcRenderer.on('langtailor:auth-error', handler)
    return () => ipcRenderer.removeListener('langtailor:auth-error', handler)
  },

  setTitle: (name: string) => ipcRenderer.invoke('langtailor:set-title', name),

  newWindow: () => ipcRenderer.invoke('langtailor:new-window'),

  getRecentProjects: () =>
    ipcRenderer.invoke('langtailor:recent-projects') as Promise<string[]>,

  openPath: (path: string) =>
    ipcRenderer.invoke('langtailor:open-path', path) as Promise<{
      ok: boolean
      path?: string
      error?: string
    }>,

  commands: {

    newGraph: () => ipcRenderer.invoke('langtailor:new-graph'),

    openProject: () => ipcRenderer.invoke('langtailor:open-project'),

    save: (text: string) => ipcRenderer.invoke('langtailor:save', text),

    build: () => ipcRenderer.invoke('langtailor:run-process', 'echo build', process.cwd()),

    run: () => ipcRenderer.invoke('langtailor:run-process', 'echo run', process.cwd()),

    test: () => ipcRenderer.invoke('langtailor:run-process', 'echo test', process.cwd()),

    export: () => ipcRenderer.invoke('langtailor:run-process', 'echo export', process.cwd()),

  },

  runGraph: (files: Record<string, string>, mode: 'run' | 'test' | 'debug' | 'build') =>

    ipcRenderer.invoke('langtailor:run-graph', { files, mode }),

  stopRun: () => ipcRenderer.invoke('langtailor:stop-run'),

  writeFiles: (dir: string, files: Record<string, string>) =>

    ipcRenderer.invoke('langtailor:write-files', dir, files),

  git: {

    status: (cwd?: string) => ipcRenderer.invoke('langtailor:git-status', cwd ?? '.'),

    stage: (paths: string[], cwd?: string) =>

      ipcRenderer.invoke('langtailor:git-stage', cwd ?? '.', paths),

    commit: (message: string, cwd?: string) =>

      ipcRenderer.invoke('langtailor:git-commit', cwd ?? '.', message),

  },

  terminal: {

    create: (cols: number, rows: number) =>

      ipcRenderer.invoke('langtailor:terminal-create', { cols, rows }),

    write: (data: string) => ipcRenderer.send('langtailor:terminal-write', data),

    resize: (cols: number, rows: number) =>

      ipcRenderer.send('langtailor:terminal-resize', { cols, rows }),

    kill: () => ipcRenderer.invoke('langtailor:terminal-kill'),

    onData: (callback: (data: string) => void) => {

      const handler = (_e: unknown, data: string) => callback(data)

      ipcRenderer.on('langtailor:terminal-data', handler)

      return () => ipcRenderer.removeListener('langtailor:terminal-data', handler)

    },

  },

  confirm: (message: string) => ipcRenderer.invoke('langtailor:confirm', message),

  parseGraph: (root: string) => ipcRenderer.invoke('langtailor:parse-graph', root),

  checkSyntax: async (files: Record<string, string>) => {

    const raw = await ipcRenderer.invoke('langtailor:check-syntax', files)

    return JSON.parse(raw as string) as Array<{

      severity: 'error' | 'warning' | 'info'

      message: string

      file?: string

      line?: number

    }>

  },

  lsp: {

    start: (root: string) => ipcRenderer.invoke('langtailor:lsp-start', root),

    stop: () => ipcRenderer.invoke('langtailor:lsp-stop'),

  },

  debug: {

    start: (config: { program: string; cwd: string }) =>

      ipcRenderer.invoke('langtailor:debug-start', config),

    stop: () => ipcRenderer.invoke('langtailor:debug-stop'),

  },

  onOutput: (callback: (line: string) => void) => {

    const handler = (_e: unknown, line: string) => callback(line)

    ipcRenderer.on('langtailor:output', handler)

    return () => ipcRenderer.removeListener('langtailor:output', handler)

  },

  onDebug: (callback: (line: string) => void) => {

    const handler = (_e: unknown, line: string) => callback(line)

    ipcRenderer.on('langtailor:debug', handler)

    return () => ipcRenderer.removeListener('langtailor:debug', handler)

  },

  plugins: {

    list: () => ipcRenderer.invoke('langtailor:plugins-list'),

    install: (manifest: unknown) => ipcRenderer.invoke('langtailor:plugins-install', manifest),

  },

})


