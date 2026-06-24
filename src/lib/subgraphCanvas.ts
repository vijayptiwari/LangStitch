import type { Edge, Node } from '@xyflow/react'
import type { CanvasSnapshot, StitchNodeData } from '../types/graph'
import { getNodeTheme } from './nodeTheme'

export const MAIN_GRAPH_ID = 'main'

export function createEmptySubgraphCanvas(): CanvasSnapshot {
  const startId = `start-${Date.now().toString(36)}`
  const endId = `end-${Date.now().toString(36)}`
  const color = getNodeTheme('start').edgeColor
  return {
    nodes: [
      {
        id: startId,
        type: 'startNode',
        position: { x: 80, y: 200 },
        data: { kind: 'start', label: 'Start' },
        deletable: false,
      },
      {
        id: endId,
        type: 'endNode',
        position: { x: 420, y: 200 },
        data: { kind: 'end', label: 'End' },
        deletable: false,
      },
    ],
    edges: [
      {
        id: `e-${startId}-${endId}`,
        source: startId,
        target: endId,
        animated: true,
        style: { stroke: color, strokeWidth: 2.5 },
      },
    ],
  }
}

export function syncCanvas(
  canvasByGraph: Record<string, CanvasSnapshot>,
  graphId: string,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
) {
  const existing = canvasByGraph[graphId]
  return { ...canvasByGraph, [graphId]: { nodes, edges, viewport: existing?.viewport } }
}
