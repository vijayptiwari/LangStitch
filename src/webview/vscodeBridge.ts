/**
 * Bridge between the LangStitch canvas (running inside a VS Code webview) and
 * the extension host. The extension owns the `.langstitch.json` TextDocument;
 * this module loads it into the graph store and pushes edits back so VS Code
 * handles dirty state, undo, and saving.
 */
import { zipSync, unzipSync, strFromU8 } from 'fflate'
import { toJpeg, toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { useGraphStore } from '../store/graphStore'
import { useIdeStore } from '../store/ideStore'
import { exportGraphDocument } from '../lib/codegen/pythonGenerator'
import { buildExportBundle } from '../lib/codegen/bundleGenerator'
import type { ExportFormat } from '../lib/codegen/bundleGenerator'

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

function zipFiles(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) {
    entries[path] = new TextEncoder().encode(content)
  }
  return zipSync(entries)
}

async function captureGraphImage(format: 'jpeg' | 'png'): Promise<string> {
  const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!viewportEl) throw new Error('Canvas viewport not found')

  const { nodes } = useGraphStore.getState()
  const bounds = getNodesBounds(nodes)
  const width = Math.max(800, bounds.width + 80)
  const height = Math.max(600, bounds.height + 80)
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 1)

  const opts = {
    width,
    height,
    backgroundColor: '#06080f',
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  }

  if (format === 'jpeg') return toJpeg(viewportEl, { ...opts, quality: 0.92 })
  return toPng(viewportEl, opts)
}

async function handleHostRequest(msg: {
  type: string
  requestId: string
  format?: ExportFormat
  zip?: Uint8Array
  version?: string
  imageFormat?: 'jpeg' | 'png'
}): Promise<void> {
  if (!vscode) return
  const { requestId } = msg
  try {
    const state = useGraphStore.getState()
    const payload = state.getProjectPayload()
    const projectJson = serialize()

    if (msg.type === 'requestBuild' || msg.type === 'requestExport') {
      const format = msg.format ?? 'full'
      const files = buildExportBundle(
        payload.document,
        projectJson,
        '',
        format,
        payload.nodes,
        payload.edges,
        payload.canvasByGraph,
      )
      if (msg.type === 'requestBuild') {
        vscode.postMessage({ type: 'buildResult', requestId, files })
      } else {
        const zip = zipFiles(files)
        vscode.postMessage({ type: 'exportResult', requestId, zip })
      }
      return
    }

    if (msg.type === 'unzipProject' && msg.zip) {
      const unzipped = unzipSync(msg.zip)
      let projectJsonText: string | undefined
      for (const key of Object.keys(unzipped)) {
        if (key.endsWith('langstitch.project.json') || key.endsWith('langsmith.json')) {
          projectJsonText = strFromU8(unzipped[key])
          break
        }
      }
      if (!projectJsonText) throw new Error('No langstitch.project.json in archive')
      vscode.postMessage({ type: 'unzipResult', requestId, projectJson: projectJsonText })
      return
    }

    if (msg.type === 'setVersion' && msg.version) {
      state.setProjectVersion(msg.version)
      vscode.postMessage({ type: 'setVersionResult', requestId })
      return
    }

    if (msg.type === 'requestExportImage') {
      const fmt = msg.imageFormat ?? 'jpeg'
      const dataUrl = await captureGraphImage(fmt)
      vscode.postMessage({ type: 'exportImageResult', requestId, dataUrl })
      return
    }
  } catch (e) {
    vscode.postMessage({
      type: 'error',
      requestId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export function initVsCodeBridge(): void {
  if (!vscode) return

  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as {
      type?: string
      text?: string
      requestId?: string
      format?: ExportFormat
      zip?: Uint8Array
      version?: string
      imageFormat?: 'jpeg' | 'png'
    }

    if ((msg.type === 'init' || msg.type === 'update') && typeof msg.text === 'string') {
      loadFromText(msg.text)
      // host:init carries the workspace file path (one window = one workspace).
      const wsPath = (msg as { path?: string }).path
      if (typeof wsPath === 'string') {
        useIdeStore.getState().setWorkspacePath(wsPath)
        useIdeStore.getState().addRecentProject(wsPath)
      }
      return
    }

    if (msg.requestId && msg.type) {
      void handleHostRequest(msg as never)
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

/** Trigger a browser download of the current graph as JPEG (web app). */
export async function downloadGraphImage(format: 'jpeg' | 'png' = 'jpeg'): Promise<void> {
  const dataUrl = await captureGraphImage(format)
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const name = useGraphStore.getState().document.name || 'graph'
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${name}.${ext}`
  a.click()
}
