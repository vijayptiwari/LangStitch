import { create } from 'zustand'
import type { ParseDiagnostic } from '../lib/codegen/pythonParser'
import type { ViewMode, VirtualFileTree } from '../lib/sync/codeGraphSync'

export type IdePanel =
  | 'explorer'
  | 'search'
  | 'run'
  | 'evaluator'
  | 'extensions'
  | null

export type BottomPanel = 'terminal' | 'problems' | 'output' | 'debug' | null

export type PlatformTab =
  | 'git'
  | 'export'
  | 'import'
  | 'versions'
  | 'build'
  | 'deploy'
  | 'eval'

interface IdeStore {
  viewMode: ViewMode
  activePanel: IdePanel
  bottomPanel: BottomPanel
  bottomPanelHeight: number
  sidePanelWidth: number
  virtualFiles: VirtualFileTree
  openFilePaths: string[]
  activeFilePath: string | null
  diagnostics: ParseDiagnostic[]
  commandPaletteOpen: boolean
  quickOpenOpen: boolean
  welcomeVisible: boolean
  recentProjects: string[]
  /** Absolute path of the currently open workspace file (null = unsaved). */
  workspacePath: string | null
  toasts: Array<{ id: string; message: string; kind: 'info' | 'warn' | 'error' }>
  syncSource: 'canvas' | 'code' | null
  terminalSessions: string[]
  outputLog: string[]
  debugLog: string[]
  debugActive: boolean
  parseDiagnostics: ParseDiagnostic[]
  syntaxDiagnostics: ParseDiagnostic[]
  /** Which Platform drawer tab is open (null = closed). */
  platformTab: PlatformTab | null
  /** Breakpoints keyed by virtual file path → sorted unique 1-based line numbers. */
  breakpoints: Record<string, number[]>
  /** Node id currently executing under the debugger (highlighted on canvas). */
  debugNodeId: string | null
  /** Whether a built graph server is currently running (Run started it). */
  runningServer: boolean

  setViewMode: (mode: ViewMode) => void
  setActivePanel: (panel: IdePanel) => void
  openPlatform: (tab: PlatformTab) => void
  closePlatform: () => void
  setBottomPanel: (panel: BottomPanel) => void
  setVirtualFiles: (files: VirtualFileTree) => void
  updateVirtualFile: (path: string, content: string) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFilePath: (path: string | null) => void
  setDiagnostics: (d: ParseDiagnostic[]) => void
  setParseDiagnostics: (d: ParseDiagnostic[]) => void
  syncDiagnostics: (syntax: ParseDiagnostic[]) => void
  appendOutput: (line: string) => void
  appendDebug: (line: string) => void
  setDebugActive: (active: boolean) => void
  setRunningServer: (running: boolean) => void
  toggleBreakpoint: (path: string, line: number) => void
  setBreakpoints: (path: string, lines: number[]) => void
  clearBreakpoints: () => void
  setDebugNodeId: (nodeId: string | null) => void
  clearOutput: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setQuickOpenOpen: (open: boolean) => void
  setWelcomeVisible: (visible: boolean) => void
  addRecentProject: (path: string) => void
  setRecentProjects: (paths: string[]) => void
  setWorkspacePath: (path: string | null) => void
  addToast: (message: string, kind?: 'info' | 'warn' | 'error') => void
  dismissToast: (id: string) => void
  setSyncSource: (source: 'canvas' | 'code' | null) => void
}

export const useIdeStore = create<IdeStore>((set, get) => ({
  viewMode: 'code',
  activePanel: 'explorer',
  bottomPanel: null,
  bottomPanelHeight: 220,
  sidePanelWidth: 260,
  virtualFiles: {},
  openFilePaths: [],
  activeFilePath: null,
  diagnostics: [],
  commandPaletteOpen: false,
  quickOpenOpen: false,
  welcomeVisible: false,
  recentProjects: [],
  workspacePath: null,
  toasts: [],
  syncSource: null,
  terminalSessions: ['default'],
  outputLog: [],
  debugLog: [],
  debugActive: false,
  parseDiagnostics: [],
  syntaxDiagnostics: [],
  platformTab: null,
  breakpoints: {},
  debugNodeId: null,
  runningServer: false,

  setViewMode: (mode) => set({ viewMode: mode, welcomeVisible: false }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  openPlatform: (tab) => set({ platformTab: tab }),
  closePlatform: () => set({ platformTab: null }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
  setVirtualFiles: (files) => set({ virtualFiles: files }),
  updateVirtualFile: (path, content) =>
    set({
      virtualFiles: { ...get().virtualFiles, [path]: content },
      syncSource: 'code',
    }),
  openFile: (path) => {
    const open = get().openFilePaths
    if (!open.includes(path)) set({ openFilePaths: [...open, path], activeFilePath: path })
    else set({ activeFilePath: path })
  },
  closeFile: (path) => {
    const open = get().openFilePaths.filter((p) => p !== path)
    const active =
      get().activeFilePath === path ? (open[open.length - 1] ?? null) : get().activeFilePath
    set({ openFilePaths: open, activeFilePath: active })
  },
  setActiveFilePath: (path) => set({ activeFilePath: path }),
  setDiagnostics: (d) => set({ diagnostics: d }),
  setParseDiagnostics: (d) =>
    set((state) => ({
      parseDiagnostics: d,
      diagnostics: [...d, ...state.syntaxDiagnostics],
    })),
  syncDiagnostics: (syntax) =>
    set((state) => ({
      syntaxDiagnostics: syntax,
      diagnostics: [...state.parseDiagnostics, ...syntax],
    })),
  appendOutput: (line) =>
    set((state) => ({
      outputLog: [...state.outputLog, line].slice(-2000),
    })),
  appendDebug: (line) =>
    set((state) => ({
      debugLog: [...state.debugLog, line].slice(-2000),
    })),
  setDebugActive: (active) => set({ debugActive: active }),
  setRunningServer: (running) => set({ runningServer: running }),
  toggleBreakpoint: (path, line) =>
    set((state) => {
      const current = state.breakpoints[path] ?? []
      const next = current.includes(line)
        ? current.filter((l) => l !== line)
        : [...current, line].sort((a, b) => a - b)
      const breakpoints = { ...state.breakpoints }
      if (next.length) breakpoints[path] = next
      else delete breakpoints[path]
      return { breakpoints }
    }),
  setBreakpoints: (path, lines) =>
    set((state) => {
      const breakpoints = { ...state.breakpoints }
      const uniqueSorted = [...new Set(lines)].sort((a, b) => a - b)
      if (uniqueSorted.length) breakpoints[path] = uniqueSorted
      else delete breakpoints[path]
      return { breakpoints }
    }),
  clearBreakpoints: () => set({ breakpoints: {} }),
  setDebugNodeId: (nodeId) => set({ debugNodeId: nodeId }),
  clearOutput: () => set({ outputLog: [] }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
  setWelcomeVisible: (visible) => set({ welcomeVisible: visible }),
  addRecentProject: (path) => {
    const recent = [path, ...get().recentProjects.filter((p) => p !== path)].slice(0, 10)
    set({ recentProjects: recent })
  },
  setRecentProjects: (paths) => set({ recentProjects: paths.slice(0, 10) }),
  setWorkspacePath: (path) => set({ workspacePath: path }),
  addToast: (message, kind = 'info') =>
    set({
      toasts: [
        ...get().toasts,
        { id: `t-${Date.now()}`, message, kind },
      ].slice(-5),
    }),
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setSyncSource: (source) => set({ syncSource: source }),
}))
