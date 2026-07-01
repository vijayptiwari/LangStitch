import { useEffect } from 'react'
import { useIdeStore } from '../store/ideStore'
import { useGraphStore } from '../store/graphStore'
import type { ParseDiagnostic } from '../lib/codegen/pythonParser'

/** Wire Electron host events (output stream, debug log) into ideStore. */
export function useIdeHost() {
  const appendOutput = useIdeStore((s) => s.appendOutput)
  const appendDebug = useIdeStore((s) => s.appendDebug)
  const setRecentProjects = useIdeStore((s) => s.setRecentProjects)
  const workspacePath = useIdeStore((s) => s.workspacePath)
  const graphName = useGraphStore((s) => s.document.name)

  useEffect(() => {
    const api = window.langtailor
    if (!api?.onOutput) return
    const unsub = api.onOutput((line) => appendOutput(line))
    return unsub
  }, [appendOutput])

  useEffect(() => {
    const api = window.langtailor
    if (!api?.onDebug) return
    const unsub = api.onDebug((line) => appendDebug(line))
    return unsub
  }, [appendDebug])

  // Load recent projects from the desktop host on startup.
  useEffect(() => {
    const api = window.langtailor
    if (!api?.getRecentProjects) return
    void api.getRecentProjects().then((paths) => setRecentProjects(paths ?? []))
  }, [setRecentProjects])

  // Keep the OS window title and browser tab title in sync with the workspace.
  useEffect(() => {
    const wsName = workspacePath
      ? workspacePath
          .split(/[\\/]/)
          .pop()!
          .replace(/\.langstitch\.json$/i, '')
          .replace(/\.json$/i, '')
      : graphName || 'Untitled'
    document.title = `${wsName} — LangTailor`
    window.langtailor?.setTitle?.(wsName)
  }, [workspacePath, graphName])
}

/** Merge parser + Python syntax diagnostics for the Problems panel. */
export function usePythonDiagnostics(virtualFiles: Record<string, string>) {
  const syncDiagnostics = useIdeStore((s) => s.syncDiagnostics)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let syntax: ParseDiagnostic[] = []
      if (window.langtailor?.checkSyntax) {
        try {
          syntax = await window.langtailor.checkSyntax(virtualFiles)
        } catch {
          syntax = []
        }
      }
      if (!cancelled) syncDiagnostics(syntax)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [virtualFiles, syncDiagnostics])
}
