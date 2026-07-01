import { useGraphStore } from '../store/graphStore'
import { useIdeStore } from '../store/ideStore'
import { graphToFiles } from './sync/codeGraphSync'

export type RunMode = 'run' | 'test' | 'debug' | 'build'

/**
 * Run / test / debug / build the current graph through the LangTailor desktop
 * host. Shared by the Run side panel and the Project menu so both behave
 * identically.
 */
export async function runGraphMode(mode: RunMode): Promise<void> {
  const gs = useGraphStore.getState()
  const is = useIdeStore.getState()
  const files = graphToFiles(
    gs.document,
    gs.nodes,
    gs.edges,
    gs.canvasByGraph,
    gs.navigationPath,
  )
  const api = window.langtailor
  if (!api?.runGraph) {
    is.addToast('Run, build and debug require the LangTailor desktop app.', 'warn')
    return
  }
  is.clearOutput()

  if (mode === 'debug') {
    const prep = await api.runGraph(files, 'debug')
    if (prep.program && prep.cwd && api.debug) {
      is.setDebugActive(true)
      is.setBottomPanel('debug')
      await api.debug.start({ program: prep.program, cwd: prep.cwd })
      is.addToast('Debugger listening on port 5678', 'info')
    }
    return
  }

  is.setBottomPanel('output')
  if (mode === 'build') is.addToast('Building project (venv + install)…', 'info')
  if (mode === 'run') is.addToast('Starting server…', 'info')
  const result = await api.runGraph(files, mode)

  if (mode === 'build') {
    if (result?.ok) {
      is.addToast(
        result.outDir ? `Build succeeded → ${result.outDir}` : 'Build succeeded',
        'info',
      )
    } else {
      is.addToast('Build finished with errors — check the Output panel', 'error')
    }
  }

  if (mode === 'run') {
    if (result?.server) {
      is.setRunningServer(true)
      is.addToast('Server running — check the Output panel', 'info')
    } else {
      is.addToast('Run needs a build first — click Build Project', 'warn')
    }
  }
}

/** Stop the running graph server started by {@link runGraphMode}. */
export async function stopGraphRun(): Promise<void> {
  const is = useIdeStore.getState()
  const api = window.langtailor
  if (!api?.stopRun) return
  await api.stopRun()
  is.setRunningServer(false)
  is.addToast('Server stopped', 'info')
}
