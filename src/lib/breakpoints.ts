import type { Node } from '@xyflow/react'
import type { GraphDocument, StitchNodeData } from '../types/graph'
import { virtualNodePath } from './codegen/nodeModuleCodegen'

/**
 * Bidirectional breakpoint mapping between the code editor and the canvas.
 *
 * Each graph node is generated to `src/<pkg>/nodes/<slug>.py`. A node "has a
 * breakpoint" when its file has any breakpoint line. Toggling a breakpoint from
 * the canvas targets the node function's first executable line so it lands on a
 * real statement the debugger can stop on.
 */

/** Map every node id → its virtual file path. */
export function nodePathMap(
  doc: GraphDocument,
  nodes: Node<StitchNodeData>[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const n of nodes) {
    if (n.data.kind === 'start' || n.data.kind === 'end') continue
    map[n.id] = virtualNodePath(doc, n.id)
  }
  return map
}

/** Reverse: file path → node id (only node module files). */
export function pathToNodeId(
  doc: GraphDocument,
  nodes: Node<StitchNodeData>[],
  path: string,
): string | null {
  for (const n of nodes) {
    if (n.data.kind === 'start' || n.data.kind === 'end') continue
    if (virtualNodePath(doc, n.id) === path) return n.id
  }
  return null
}

/**
 * Find the first executable line (1-based) inside a node module — the line right
 * after `def <fn>(...)` and its docstring / custom-region marker. This is where
 * a canvas-triggered breakpoint is placed so it stops on real code.
 */
export function firstExecutableLine(content: string): number {
  const lines = content.split('\n')
  const defIdx = lines.findIndex((l) => /^def\s+\w+\s*\(/.test(l.trim()) || /^\s*def\s+\w+\s*\(/.test(l))
  if (defIdx === -1) return 1
  // Skip the def line, an optional docstring line, and the custom-region marker.
  for (let i = defIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) continue
    if (t.startsWith('"""') || t.startsWith("'''")) continue
    if (t.startsWith('# region') || t.startsWith('# endregion')) continue
    return i + 1
  }
  return defIdx + 2
}

/** True when any breakpoint line exists in the node's file. */
export function nodeHasBreakpoint(
  breakpoints: Record<string, number[]>,
  path: string | undefined,
): boolean {
  if (!path) return false
  return (breakpoints[path]?.length ?? 0) > 0
}
