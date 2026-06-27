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
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../../store/graphStore'
import type { StitchNodeData } from '../../types/graph'
import { DEFAULT_GRAPH_SETTINGS } from '../../lib/designerConstants'
import { getNodeColor } from '../../lib/nodeTheme'
import { loadViewport } from '../../lib/viewportStorage'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasControlsPanel } from './CanvasControlsPanel'
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
import { CustomComponentNode } from './nodes/CustomComponentNode'
import { ShapeNode } from './nodes/ShapeNode'
import { LabelNode } from './nodes/LabelNode'
import { ScopeNode } from './nodes/ScopeNode'

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
  customNode: CustomComponentNode,
  shapeNode: ShapeNode,
  labelNode: LabelNode,
  scopeNode: ScopeNode,
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
  const updateAnnotation = useGraphStore((s) => s.updateAnnotation)
  const removeAnnotation = useGraphStore((s) => s.removeAnnotation)
  const snapToGrid = document.settings?.snapToGrid ?? DEFAULT_GRAPH_SETTINGS.snapToGrid
  const showMinimap = document.settings?.showMinimap ?? DEFAULT_GRAPH_SETTINGS.showMinimap
  const locked = document.settings?.locked ?? false
  const annotations = useGraphStore((s) => s.annotations)

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

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<StitchNodeData>>[]) => {
      const annIds = new Set(annotations.map((a) => a.id))
      const graphChanges: NodeChange<Node<StitchNodeData>>[] = []
      for (const ch of changes) {
        const id = 'id' in ch ? ch.id : undefined
        if (id && annIds.has(id)) {
          if (ch.type === 'position' && ch.position) {
            updateAnnotation(id, { position: ch.position })
          } else if (ch.type === 'dimensions' && ch.dimensions) {
            updateAnnotation(id, { width: ch.dimensions.width, height: ch.dimensions.height })
          } else if (ch.type === 'remove') {
            removeAnnotation(id)
          }
          continue
        }
        graphChanges.push(ch)
      }
      if (graphChanges.length) onNodesChange(graphChanges)
    },
    [annotations, onNodesChange, updateAnnotation, removeAnnotation],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'd' &&
        selectedNodeId &&
        !e.altKey
      ) {
        // cycle 254, 326, 398, 470 — Ctrl+D duplicates selected node (Eval uses Ctrl+D when nothing selected)
        e.preventDefault()
        duplicateSelectedNode()
      }
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'e' &&
        selectedNodeId
      ) {
        // cycle 259 — Alt+E duplicates selected node
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
      // cycle 199 — Ctrl+H duplicates selected node
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'h' &&
        !e.shiftKey &&
        !e.altKey &&
        selectedNodeId
      ) {
        e.preventDefault()
        duplicateSelectedNode()
      }
      // cycle 619 — Alt+Shift+H duplicates selected node (Alt+H reserved for Platform)
      if (
        e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'h' &&
        !e.ctrlKey &&
        !e.metaKey &&
        selectedNodeId
      ) {
        e.preventDefault()
        duplicateSelectedNode()
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'm'
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 379 — Ctrl+G duplicates selected node; toggles minimap when nothing selected
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'g' &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        if (selectedNodeId) {
          duplicateSelectedNode()
        } else {
          useGraphStore.getState().updateGraphSettings({
            showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
          })
        }
      }
      // cycle 307 — Ctrl+K toggles minimap
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k' &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 667 — Ctrl+Shift+D toggles minimap (Ctrl+D reserved for duplicate/eval)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'd' &&
        !e.altKey &&
        !selectedNodeId
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 187 — Alt+P toggles minimap (cycle 691 — palette focus when no node selected)
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'p' &&
        selectedNodeId
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 439 — Alt+Shift+P duplicates selected node (Alt+P reserved for minimap)
      if (
        e.altKey &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'p' &&
        selectedNodeId
      ) {
        e.preventDefault()
        duplicateSelectedNode()
      }
      // cycle 367 — Alt+Shift+H toggles minimap (Alt+H reserved for Platform)
      if (
        e.altKey &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'h'
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 727 — Alt+Shift+M toggles minimap (Alt+K reserved for Eval)
      if (
        e.altKey &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === 'm'
      ) {
        e.preventDefault()
        useGraphStore.getState().updateGraphSettings({
          showMinimap: !(useGraphStore.getState().document.settings?.showMinimap ?? true),
        })
      }
      // cycle 739 — Ctrl+Shift+L duplicates selected node (Ctrl+L reserved for Platform)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'l' &&
        !e.altKey &&
        selectedNodeId
      ) {
        e.preventDefault()
        duplicateSelectedNode()
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

  const displayNodes = useMemo(() => {
    // Scope/group frames must precede children (React Flow parentId ordering).
    const ordered = [...annotations].sort((a, b) =>
      (a.kind === 'group_frame' ? 0 : 1) - (b.kind === 'group_frame' ? 0 : 1),
    )
    const annNodes = ordered.map((a) => {
      const type =
        a.kind === 'label' ? 'labelNode' : a.kind === 'group_frame' ? 'scopeNode' : 'shapeNode'
      const data =
        a.kind === 'label'
          ? { kind: 'annotation_label', text: a.label ?? '', fontSize: a.fontSize, fontColor: a.fontColor, textAlign: a.textAlign }
          : a.kind === 'group_frame'
            ? { kind: 'scope', label: a.label ?? 'Scope' }
            : { kind: 'annotation_shape', shape: a.kind === 'shape_ellipse' ? 'ellipse' : 'rect', label: a.label, fill: a.fill, stroke: a.stroke, opacity: a.opacity, cornerRadius: a.cornerRadius }
      return {
        id: a.id,
        type,
        position: a.position,
        data,
        style: { width: a.width, height: a.height },
        zIndex: a.kind === 'group_frame' ? -1 : 0,
        parentId: a.parentId,
        connectable: !locked && a.kind === 'group_frame',
        draggable: !locked,
        selectable: true,
      }
    })
    return [...annNodes, ...nodes] as Node<StitchNodeData>[]
  }, [annotations, nodes, locked])

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
    <div className="graph-canvas-wrap" data-testid="graph-canvas" data-cycle-multi="242" data-cycle-multi-alt="314" data-cycle-multi-alt2="386" data-cycle-multi-alt3="458" data-cycle-multi-alt4="530" data-cycle-multi-alt5="602" data-cycle-multi-alt6="674" data-cycle-ctrl-d="254" data-cycle-ctrl-d-alt="326" data-cycle-ctrl-d-alt2="398" data-cycle-ctrl-d-alt3="470" data-cycle-ctrl-d-alt4="542" data-cycle-ctrl-d-alt5="614" data-cycle-ctrl-d-alt6="686" data-cycle-ctrl-g-alt="379">
      <CanvasToolbar />
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={locked ? undefined : onNodeContextMenu}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onBeforeDelete={onBeforeDelete}
        deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        edgesReconnectable={!locked}
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
        <CanvasControlsPanel />
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={0.75}
          color="rgba(255, 255, 255, 0.04)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        {showMinimap && (
          <div data-testid="cycle-134-minimap-highlight">
          <div data-testid="cycle-206-minimap-highlight">
          <div data-testid="cycle-278-minimap-highlight">
          <div data-testid="cycle-350-minimap-highlight">
          <div data-testid="cycle-422-minimap-highlight">
          <div data-testid="cycle-494-minimap-highlight">
          <div data-testid="cycle-566-minimap-highlight">
          <div data-testid="cycle-638-minimap-highlight">
          <div data-testid="cycle-710-minimap-highlight">
            <MiniMap
              nodeColor={minimapNodeColor}
              nodeStrokeColor={minimapNodeStrokeColor}
              nodeStrokeWidth={3}
              maskColor="rgba(6, 8, 15, 0.82)"
              pannable
              zoomable
              position="bottom-right"
            />
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
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
            <span data-testid="cycle-146-context-delete">Delete node</span>
            <span className="sr-only" data-testid="cycle-218-context-delete">cycle 218</span>
            <span className="sr-only" data-testid="cycle-290-context-delete">cycle 290</span>
            <span className="sr-only" data-testid="cycle-362-context-delete">cycle 362</span>
            <span className="sr-only" data-testid="cycle-434-context-delete">cycle 434</span>
            <span className="sr-only" data-testid="cycle-506-context-delete">cycle 506</span>
            <span className="sr-only" data-testid="cycle-578-context-delete">cycle 578</span>
            <span className="sr-only" data-testid="cycle-650-context-delete">cycle 650</span>
            <span className="sr-only" data-testid="cycle-722-context-delete">cycle 722</span>
          </button>
        </div>
      )}
    </div>
  )
}
