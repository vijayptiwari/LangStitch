import type { Edge, Node } from '@xyflow/react'
import type { CanvasSnapshot, GraphDocument, StitchNodeData } from '../../types/graph'
import { buildExportBundle } from '../codegen/bundleGenerator'
import { exportGraphDocument } from '../codegen/pythonGenerator'
import { createNodeData, nodeTypes } from '../nodeRegistry'
import type { NodeKind } from '../../types/graph'
import {
  applyCustomCodeUpdates,
  filesToGraphDelta,
  parseGraphFromVirtualFiles,
  type GraphDelta,
  type ParseDiagnostic,
  type ParseGraphResult,
} from '../codegen/pythonParser'
import { virtualNodePath } from '../codegen/nodeModuleCodegen'

export type ViewMode = 'canvas' | 'code'
export type SyncSource = 'canvas' | 'code' | null

export interface VirtualFileTree {
  [path: string]: string
}

export interface SyncState {
  virtualFiles: VirtualFileTree
  diagnostics: ParseDiagnostic[]
  lastSyncSource: SyncSource
  parseError: string | null
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
const DEBOUNCE_MS = 300

function serializeProject(
  document: GraphDocument,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  canvasByGraph: Record<string, CanvasSnapshot>,
  navigationPath: string[],
): string {
  return exportGraphDocument(document, nodes, edges, canvasByGraph, navigationPath)
}

/** Project graph state -> virtual Python files for the code editor. */
export function graphToFiles(
  document: GraphDocument,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  canvasByGraph: Record<string, CanvasSnapshot>,
  navigationPath: string[],
): VirtualFileTree {
  const projectJson = serializeProject(document, nodes, edges, canvasByGraph, navigationPath)
  const bundle = buildExportBundle(
    document,
    projectJson,
    '',
    'python',
    nodes,
    edges,
    canvasByGraph,
  )
  const pyOnly: VirtualFileTree = {}
  for (const [path, content] of Object.entries(bundle)) {
    if (path.endsWith('.py') || path.endsWith('.toml') || path.endsWith('.json')) {
      pyOnly[path] = content
    }
  }
  return pyOnly
}

function createNodeFromParsed(id: string, kind: string, label: string): Node<StitchNodeData> {
  const nodeKind = (kind in nodeTypes ? kind : 'function') as NodeKind
  const data = createNodeData(nodeKind)
  return {
    id,
    type: nodeTypes[nodeKind],
    position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
    data: { ...data, label },
  }
}

/** Virtual file edits -> graph delta (does not apply; caller must apply after confirmation). */
export function filesToGraphDeltaFromVirtual(
  files: VirtualFileTree,
  currentNodes: Node<StitchNodeData>[],
  currentEdges: Edge[],
): { delta: GraphDelta; parsed: ParseGraphResult } {
  const parsed = parseGraphFromVirtualFiles(files)
  const delta = filesToGraphDelta(
    currentNodes,
    currentEdges,
    parsed,
    createNodeFromParsed,
  )
  return { delta, parsed }
}

export function scheduleSyncFromCode(
  files: VirtualFileTree,
  activeSource: SyncSource,
  onSync: (files: VirtualFileTree) => void,
): void {
  if (activeSource !== 'code') return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => onSync(files), DEBOUNCE_MS)
}

export function scheduleSyncFromCanvas(
  project: () => VirtualFileTree,
  activeSource: SyncSource,
  onSync: (files: VirtualFileTree) => void,
): void {
  if (activeSource !== 'canvas') return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => onSync(project()), DEBOUNCE_MS)
}

export function applyGraphDelta(
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  delta: GraphDelta,
): { nodes: Node<StitchNodeData>[]; edges: Edge[] } {
  let nextNodes = nodes.filter((n) => !delta.nodesToRemove.includes(n.id))
  nextNodes = [...nextNodes, ...delta.nodesToAdd]
  nextNodes = applyCustomCodeUpdates(nextNodes, delta.customCodeUpdates)
  let nextEdges = edges.filter((e) => !delta.edgesToRemove.includes(e.id))
  nextEdges = [...nextEdges, ...delta.edgesToAdd]
  return { nodes: nextNodes, edges: nextEdges }
}

export function nodeModulePathForSelection(
  document: GraphDocument,
  nodeId: string,
): string | null {
  return virtualNodePath(document, nodeId)
}
