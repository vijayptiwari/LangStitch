export interface LangTailorGitStatus {

  branch?: string

  lines?: string[]

}



export interface LangTailorTerminalApi {

  create: (cols: number, rows: number) => Promise<{ ok: boolean }>

  write: (data: string) => void

  resize: (cols: number, rows: number) => void

  kill: () => Promise<{ ok: boolean }>

  onData: (callback: (data: string) => void) => () => void

}



export interface LangTailorCommandsApi {

  newGraph: () => Promise<void>

  openProject: () => Promise<void>

  save: (text: string) => Promise<{ ok: boolean; path?: string }>

  build: () => Promise<void>

  run: () => Promise<void>

  test: () => Promise<void>

  export: () => Promise<void>

}



export interface LangTailorApi {

  isElectron: boolean

  openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>

  getPlatformApiBase?: () => Promise<string>

  getAuthToken?: () => Promise<{ token: string | null }>

  setAuthToken?: (token: string | null) => Promise<{ ok: boolean }>

  onAuthToken?: (cb: (token: string | null) => void) => () => void

  onAuthError?: (cb: (error: string) => void) => () => void

  setTitle?: (name: string) => Promise<{ ok: boolean }>

  newWindow?: () => Promise<{ ok: boolean }>

  getRecentProjects?: () => Promise<string[]>

  openPath?: (path: string) => Promise<{ ok: boolean; path?: string; error?: string }>

  commands?: LangTailorCommandsApi

  runGraph?: (

    files: Record<string, string>,

    mode: 'run' | 'test' | 'debug' | 'build',

  ) => Promise<{
    exitCode?: number | null
    ok?: boolean
    cwd?: string
    program?: string
    outDir?: string
    server?: boolean
    pid?: number
  }>

  stopRun?: () => Promise<{ ok: boolean; stopped: boolean }>

  writeFiles?: (dir: string, files: Record<string, string>) => Promise<{ ok: boolean }>

  git?: {

    status: (cwd?: string) => Promise<LangTailorGitStatus>

    stage: (paths: string[], cwd?: string) => Promise<void>

    commit: (message: string, cwd?: string) => Promise<void>

  }

  terminal?: LangTailorTerminalApi

  lsp?: {

    start: (root: string) => Promise<{ ok: boolean }>

    stop: () => Promise<{ ok: boolean }>

  }

  debug?: {

    start: (config: { program: string; cwd: string }) => Promise<{ ok: boolean; port?: number }>

    stop: () => Promise<{ ok: boolean }>

  }

  confirm?: (message: string) => Promise<boolean>

  parseGraph?: (projectRoot: string) => Promise<string>

  checkSyntax?: (

    files: Record<string, string>,

  ) => Promise<

    Array<{

      severity: 'error' | 'warning' | 'info'

      message: string

      file?: string

      line?: number

    }>

  >

  onOutput?: (callback: (line: string) => void) => () => void

  onDebug?: (callback: (line: string) => void) => () => void

  plugins?: {

    list: () => Promise<unknown[]>

    install: (manifest: unknown) => Promise<unknown>

  }

}



declare global {

  interface Window {

    langtailor?: LangTailorApi

    acquireVsCodeApi?: () => {

      postMessage: (message: unknown) => void

      getState: () => unknown

      setState: (state: unknown) => void

    }

  }

}



export {}


