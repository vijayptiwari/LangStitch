import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../../store/graphStore'
import type { StitchNodeData } from '../../types/graph'
import { DEFAULT_GRAPH_SETTINGS } from '../../lib/designerConstants'
import { getNodeColor } from '../../lib/nodeTheme'
import { loadViewport } from '../../lib/viewportStorage'
import { CanvasToolbar } from './CanvasToolbar'
import { TruncatedEdge } from './TruncatedEdge'
import { StartNode } from './nodes/StartNode'
import { EndNode } from './nodes/EndNode'
import { LLMNode } from './nodes/LLMNode'
import { ToolNode } from './nodes/ToolNode'
import { RouterNode } from './nodes/RouterNode'
import { FunctionNode } from './nodes/FunctionNode'
import { SubgraphNode } from './nodes/SubgraphNode'
import { AgentNode } from './nodes/AgentNode'
import { RagNode } from './nodes/RagNode'
import { IntentClassifierNode } from './nodes/IntentClassifierNode'

const nodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  llmNode: LLMNode,
  toolNode: ToolNode,
  routerNode: RouterNode,
  functionNode: FunctionNode,
  subgraphNode: SubgraphNode,
  agentNode: AgentNode,
  ragNode: RagNode,
  intentClassifierNode: IntentClassifierNode,
}

const edgeTypes = {
  truncated: TruncatedEdge,
}

function ViewportRestore() {
  const { setViewport } = useReactFlow()
  const projectName = useGraphStore((s) => s.document.name)
  const activeSubgraphId = useGraphStore((s) => s.document.activeSubgraphId)
  const canvasByGraph = useGraphStore((s) => s.canvasByGraph)

  useEffect(() => {
    const fromCanvas = canvasByGraph[activeSubgraphId]?.viewport
    const fromStorage = loadViewport(projectName)
    const viewport = fromCanvas ?? fromStorage
    if (viewport) {
      setViewport(viewport, { duration: 0 })
    }
  }, [projectName, activeSubgraphId, setViewport])

  return null
}

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const document = useGraphStore((s) => s.document)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)
  const duplicateSelectedNode = useGraphStore((s) => s.duplicateSelectedNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(
    null,
  )
  const setDesignerTab = useGraphStore((s) => s.setDesignerTab)
  const enterSubgraph = useGraphStore((s) => s.enterSubgraph)
  const updateViewport = useGraphStore((s) => s.updateViewport)
  const snapToGrid = document.settings?.snapToGrid ?? DEFAULT_GRAPH_SETTINGS.snapToGrid
  const showMinimap = document.settings?.showMinimap ?? DEFAULT_GRAPH_SETTINGS.showMinimap

  const minimapNodeColor = useCallback(
    (n: Node<StitchNodeData>) => getNodeColor(n.data?.kind as string | undefined),
    [],
  )

  const minimapNodeStrokeColor = useCallback(
    (n: Node<StitchNodeData>) => (n.id === selectedNodeId ? '#fbbf24' : 'transparent'),
    [selectedNodeId],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<StitchNodeData>) => selectNode(node.id),
    [selectNode],
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<StitchNodeData>) => {
      if (node.data.kind === 'subgraph') {
        const targetId =
          node.data.connectionType === 'local' ? node.data.subgraphId : null
        if (targetId) {
          enterSubgraph(targetId)
          return
        }
      }
      if (node.data.kind === 'agent' && node.data.connectionType === 'subagent' && node.data.subgraphId) {
        enterSubgraph(node.data.subgraphId)
        return
      }
      selectNode(node.id)
      setDesignerTab('node')
    },
    [selectNode, setDesignerTab, enterSubgraph],
  )

  const onPaneClick = useCallback(() => selectNode(null), [selectNode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'd' &&
        selectedNodeId &&
        !e.altKey
      ) {
        e.preventDefault()
        duplicateSelectedNode()
      }
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'd' &&
        selectedNodeId
      ) {
        e.preventDefault()
        duplicateSelectedNode()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeId, duplicateSelectedNode])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node<StitchNodeData>) => {
      e.preventDefault()
      e.stopPropagation()
      if (node.data?.kind === 'start' || node.data?.kind === 'end') return
      selectNode(node.id)
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [selectNode],
  )

  const handleContextDelete = useCallback(() => {
    if (!contextMenu) return
    removeNode(contextMenu.nodeId)
    setContextMenu(null)
  }, [contextMenu, removeNode])

  const onMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => {
      updateViewport(viewport)
    },
    [updateViewport],
  )

  const onBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete }: { nodes: Node<StitchNodeData>[]; edges: Edge[] }) => {
      const deletable = nodesToDelete.filter(
        (n) => n.data?.kind !== 'start' && n.data?.kind !== 'end',
      )
      if (deletable.length === 0) return false
      if (deletable.length >= 2) {
        return window.confirm(
          `Delete ${deletable.length} selected nodes? This cannot be undone.`,
        )
      }
      return true
    },
    [],
  )

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'truncated',
      animated: false,
      style: { strokeWidth: 2, stroke: '#6366f1' },
    }),
    [],
  )

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: edge.label ? 'truncated' : edge.type,
      })),
    [edges],
  )

  const connectionLineStyle = useMemo(
    () => ({ stroke: '#7c89ff', strokeWidth: 2 }),
    [],
  )

  return (
    <div className="graph-canvas-wrap" data-testid="graph-canvas">
      <CanvasToolbar />
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onBeforeDelete={onBeforeDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportRestore />
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={0.75}
          color="rgba(255, 255, 255, 0.04)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapNodeStrokeColor}
            nodeStrokeWidth={3}
            maskColor="rgba(6, 8, 15, 0.82)"
            pannable
            zoomable
            position="bottom-right"
          />
        )}
      </ReactFlow>
      {contextMenu && (
        <div
          className="canvas-context-menu"
          data-testid="canvas-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="canvas-context-menu-item"
            data-testid="canvas-context-delete"
            onClick={handleContextDelete}
          >
            Delete node
          </button>
        </div>
      )}
    </div>
  )
}
