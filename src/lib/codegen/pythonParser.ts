import type { Node } from '@xyflow/react'
import type { Edge } from '@xyflow/react'
import type { StitchNodeData } from '../../types/graph'
import { setNodeCode } from '../nodeCode'

export interface ParseDiagnostic {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
}

export interface ParsedNode {
  id: string
  kind: string
  label: string
  customCode: string
  modulePath?: string
}

export interface ParsedEdge {
  source: string
  target: string
  label?: string
}

export interface ParseGraphResult {
  nodes: ParsedNode[]
  edges: ParsedEdge[]
  diagnostics: ParseDiagnostic[]
  error?: string
}

export interface GraphDelta {
  nodesToAdd: Node<StitchNodeData>[]
  nodesToRemove: string[]
  nodesToUpdate: Array<{ id: string; data: Partial<StitchNodeData> }>
  edgesToAdd: Edge[]
  edgesToRemove: string[]
  customCodeUpdates: Array<{ nodeId: string; customCode: string }>
}

/** Invoke parse_graph.py sidecar (Electron main or dev server provides cwd). */
export async function parseGraphFromDisk(
  projectRoot: string,
  invokeSidecar?: (script: string, args: string[]) => Promise<string>,
): Promise<ParseGraphResult> {
  if (invokeSidecar) {
    try {
      const raw = await invokeSidecar('runtime/parse_graph.py', [projectRoot])
      return JSON.parse(raw) as ParseGraphResult
    } catch (e) {
      return {
        nodes: [],
        edges: [],
        diagnostics: [
          {
            severity: 'error',
            message: e instanceof Error ? e.message : String(e),
          },
        ],
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }
  return { nodes: [], edges: [], diagnostics: [], error: 'No parser sidecar available' }
}

/** Parse in-memory virtual files (web IDE path). */
export function parseGraphFromVirtualFiles(
  files: Record<string, string>,
): ParseGraphResult {
  const nodes: ParsedNode[] = []
  const edges: ParsedEdge[] = []
  const diagnostics: ParseDiagnostic[] = []

  const metaRe = /^#\s*langstitch:node\s+id=(\S+)\s+kind=(\S+)\s+label=(.+)$/m
  const customBegin = '# region CUSTOM'
  const customEnd = '# endregion CUSTOM'
  const addEdgeRe =
    /builder\.add_edge\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["'](?:\s*,\s*["']([^"']*)["'])?\s*\)/g

  for (const [path, content] of Object.entries(files)) {
    if (!path.includes('/nodes/') || !path.endsWith('.py') || path.endsWith('__init__.py')) continue
    const meta = metaRe.exec(content)
    if (!meta) continue
    const [, id, kind, labelJson] = meta
    let label = labelJson
    try {
      label = JSON.parse(labelJson) as string
    } catch {
      /* keep raw */
    }
    const begin = content.indexOf(customBegin)
    const end = content.indexOf(customEnd)
    let customCode = 'return {}'
    if (begin !== -1 && end !== -1 && end > begin) {
      customCode = content
        .slice(begin + customBegin.length, end)
        .split('\n')
        .map((l) => (l.startsWith('    ') ? l.slice(4) : l))
        .join('\n')
        .trim() || 'return {}'
    }
    nodes.push({ id, kind, label, customCode, modulePath: path })
  }

  for (const [path, content] of Object.entries(files)) {
    if (!path.includes('/graphs/') || !path.endsWith('main.py')) continue
    let m: RegExpExecArray | null
    while ((m = addEdgeRe.exec(content)) !== null) {
      edges.push({ source: m[1], target: m[2], label: m[3] || '' })
    }
  }

  if (nodes.length === 0 && Object.keys(files).some((f) => f.includes('/nodes/'))) {
    diagnostics.push({ severity: 'warning', message: 'No annotated node modules found' })
  }

  return { nodes, edges, diagnostics }
}

export function filesToGraphDelta(
  currentNodes: Node<StitchNodeData>[],
  currentEdges: Edge[],
  parsed: ParseGraphResult,
  createNode: (id: string, kind: string, label: string) => Node<StitchNodeData>,
): GraphDelta {
  const delta: GraphDelta = {
    nodesToAdd: [],
    nodesToRemove: [],
    nodesToUpdate: [],
    edgesToAdd: [],
    edgesToRemove: [],
    customCodeUpdates: [],
  }

  if (parsed.error) return delta

  const currentIds = new Set(currentNodes.map((n) => n.id))
  const parsedIds = new Set(parsed.nodes.map((n) => n.id))

  for (const pn of parsed.nodes) {
    if (!currentIds.has(pn.id)) {
      delta.nodesToAdd.push(createNode(pn.id, pn.kind, pn.label))
    } else {
      delta.customCodeUpdates.push({ nodeId: pn.id, customCode: pn.customCode })
    }
  }

  for (const id of currentIds) {
    const node = currentNodes.find((n) => n.id === id)
    if (node?.data.kind === 'start' || node?.data.kind === 'end') continue
    if (!parsedIds.has(id)) {
      delta.nodesToRemove.push(id)
    }
  }

  const edgeKey = (e: { source: string; target: string }) => `${e.source}->${e.target}`
  const currentEdgeKeys = new Set(currentEdges.map(edgeKey))
  const parsedEdgeKeys = new Set(parsed.edges.map(edgeKey))

  for (const pe of parsed.edges) {
    if (!currentEdgeKeys.has(edgeKey(pe))) {
      delta.edgesToAdd.push({
        id: `e-${pe.source}-${pe.target}`,
        source: pe.source,
        target: pe.target,
        label: pe.label,
        animated: true,
      })
    }
  }

  for (const ce of currentEdges) {
    if (!parsedEdgeKeys.has(edgeKey(ce))) {
      delta.edgesToRemove.push(ce.id)
    }
  }

  return delta
}

export function applyCustomCodeUpdates(
  nodes: Node<StitchNodeData>[],
  updates: Array<{ nodeId: string; customCode: string }>,
): Node<StitchNodeData>[] {
  const byId = new Map(updates.map((u) => [u.nodeId, u.customCode]))
  return nodes.map((n) => {
    const code = byId.get(n.id)
    if (code === undefined) return n
    return { ...n, data: setNodeCode(n.data, code) as StitchNodeData }
  })
}
