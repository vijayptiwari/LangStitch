import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { StitchNodeData } from '../../types/graph'

const DEFAULT_W = 220
const DEFAULT_H = 80

function nodeSize(node: Node<StitchNodeData>): { width: number; height: number } {
  const w = node.measured?.width ?? node.width ?? DEFAULT_W
  const h = node.measured?.height ?? node.height ?? DEFAULT_H
  return { width: typeof w === 'number' ? w : DEFAULT_W, height: typeof h === 'number' ? h : DEFAULT_H }
}

/** Lay out logical nodes (excludes annotations). Scope-aware: children laid out within parent first. */
export function autoLayout(
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): Node<StitchNodeData>[] {
  const logical = nodes.filter(
    (n) => !n.type?.includes('shape') && !n.type?.includes('label') && n.type !== 'scopeNode',
  )
  const scopes = nodes.filter((n) => n.type === 'scopeNode')
  const other = nodes.filter(
    (n) => n.type?.includes('shape') || n.type?.includes('label'),
  )

  const topLevel = logical.filter((n) => !n.parentId)
  const laidOut = layoutSubset(topLevel, edges, direction)

  const scopeResults: Node<StitchNodeData>[] = []
  for (const scope of scopes) {
    const children = logical.filter((n) => n.parentId === scope.id)
    const childEdges = edges.filter(
      (e) => children.some((c) => c.id === e.source) && children.some((c) => c.id === e.target),
    )
    const laidChildren = layoutSubset(children, childEdges, direction)
    const maxX = Math.max(...laidChildren.map((c) => c.position.x + nodeSize(c).width), 200)
    const maxY = Math.max(...laidChildren.map((c) => c.position.y + nodeSize(c).height), 120)
    scopeResults.push({
      ...scope,
      style: { ...scope.style, width: maxX + 40, height: maxY + 40 },
    })
    scopeResults.push(...laidChildren)
  }

  const scopeIds = new Set(scopes.map((s) => s.id))
  const topWithScopes = layoutSubset(
    [...laidOut.filter((n) => !n.parentId), ...scopeResults.filter((n) => n.type === 'scopeNode')],
    edges.filter((e) => !scopeIds.has(e.source) && !scopeIds.has(e.target) || scopes.some((s) => e.source === s.id || e.target === s.id)),
    direction,
  )

  const byId = new Map<string, Node<StitchNodeData>>()
  for (const n of [...topWithScopes, ...scopeResults.filter((n) => n.type !== 'scopeNode'), ...other]) {
    byId.set(n.id, n)
  }
  return nodes.map((n) => byId.get(n.id) ?? n)
}

function layoutSubset(
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB',
): Node<StitchNodeData>[] {
  if (nodes.length === 0) return []
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 })

  for (const node of nodes) {
    const { width, height } = nodeSize(node)
    g.setNode(node.id, { width, height })
  }
  const ids = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const { width, height } = nodeSize(node)
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    }
  })
}

export type AlignMode =
  | 'left'
  | 'hcenter'
  | 'right'
  | 'top'
  | 'vcenter'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v'

export function alignNodes(
  nodes: Node<StitchNodeData>[],
  selectedIds: Set<string>,
  mode: AlignMode,
): Node<StitchNodeData>[] {
  const selected = nodes.filter((n) => selectedIds.has(n.id))
  if (selected.length === 0) return nodes

  const sizes = selected.map((n) => ({ node: n, ...nodeSize(n) }))
  const minX = Math.min(...sizes.map((s) => s.node.position.x))
  const maxX = Math.max(...sizes.map((s) => s.node.position.x + s.width))
  const minY = Math.min(...sizes.map((s) => s.node.position.y))
  const maxY = Math.max(...sizes.map((s) => s.node.position.y + s.height))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  const updates = new Map<string, { x: number; y: number }>()

  if (mode === 'distribute-h' && selected.length >= 3) {
    const sorted = [...sizes].sort((a, b) => a.node.position.x - b.node.position.x)
    const totalW = sorted.reduce((s, x) => s + x.width, 0)
    const gap = (maxX - minX - totalW) / (sorted.length - 1)
    let x = minX
    for (const s of sorted) {
      updates.set(s.node.id, { x, y: s.node.position.y })
      x += s.width + gap
    }
  } else if (mode === 'distribute-v' && selected.length >= 3) {
    const sorted = [...sizes].sort((a, b) => a.node.position.y - b.node.position.y)
    const totalH = sorted.reduce((s, x) => s + x.height, 0)
    const gap = (maxY - minY - totalH) / (sorted.length - 1)
    let y = minY
    for (const s of sorted) {
      updates.set(s.node.id, { x: s.node.position.x, y })
      y += s.height + gap
    }
  } else {
    for (const s of sizes) {
      let x = s.node.position.x
      let y = s.node.position.y
      if (mode === 'left') x = minX
      if (mode === 'right') x = maxX - s.width
      if (mode === 'hcenter') x = midX - s.width / 2
      if (mode === 'top') y = minY
      if (mode === 'bottom') y = maxY - s.height
      if (mode === 'vcenter') y = midY - s.height / 2
      updates.set(s.node.id, { x, y })
    }
  }

  return nodes.map((n) => {
    const u = updates.get(n.id)
    return u ? { ...n, position: u } : n
  })
}
