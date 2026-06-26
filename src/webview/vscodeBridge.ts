/**
 * Bridge between the LangStitch canvas (running inside a VS Code webview) and
 * the extension host. The extension owns the `.langstitch.json` TextDocument;
 * this module loads it into the graph store and pushes edits back so VS Code
 * handles dirty state, undo, and saving.
 */
import { useGraphStore } from '../store/graphStore'
import { exportGraphDocument } from '../lib/codegen/pythonGenerator'

interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

const vscode: VsCodeApi | null =
  typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null

export function isVsCode(): boolean {
  return vscode !== null
}

let applyingRemote = false

function serialize(): string {
  const state = useGraphStore.getState()
  const payload = state.getProjectPayload()
  return exportGraphDocument(
    payload.document,
    payload.nodes,
    payload.edges,
    payload.canvasByGraph,
    payload.navigationPath,
  )
}

function loadFromText(text: string): void {
  if (!text || !text.trim()) return
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch {
    return
  }
  const { loadProject } = useGraphStore.getState()
  applyingRemote = true
  try {
    if (raw.document) {
      loadProject(raw as never)
    } else {
      const { nodes, edges, canvasByGraph, navigationPath, ...document } = raw as Record<
        string,
        unknown
      >
      loadProject({ document, nodes, edges, canvasByGraph, navigationPath } as never)
    }
  } finally {
    applyingRemote = false
  }
}

export function initVsCodeBridge(): void {
  if (!vscode) return

  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type?: string; text?: string }
    if ((msg.type === 'init' || msg.type === 'update') && typeof msg.text === 'string') {
      loadFromText(msg.text)
    }
  })

  let debounce: ReturnType<typeof setTimeout> | undefined
  let lastSent = ''
  useGraphStore.subscribe(() => {
    if (applyingRemote) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      const text = serialize()
      if (text === lastSent) return
      lastSent = text
      vscode.postMessage({ type: 'edit', text })
    }, 250)
  })

  vscode.postMessage({ type: 'ready' })
}
