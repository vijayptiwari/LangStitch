import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../../store/graphStore'
import type { StitchNodeData } from '../../types/graph'
import { getNodeColor } from '../../lib/nodeTheme'
import { CanvasToolbar } from './CanvasToolbar'
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

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)
  const setDesignerTab = useGraphStore((s) => s.setDesignerTab)
  const enterSubgraph = useGraphStore((s) => s.enterSubgraph)

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

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { strokeWidth: 2.5 },
    }),
    [],
  )

  const connectionLineStyle = useMemo(
    () => ({ stroke: '#818cf8', strokeWidth: 2.5 }),
    [],
  )

  return (
    <div className="graph-canvas-wrap" data-testid="graph-canvas">
      <CanvasToolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="rgba(100, 116, 139, 0.22)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          nodeColor={(n) => getNodeColor(n.data?.kind as string | undefined)}
          maskColor="rgba(6, 8, 15, 0.82)"
          pannable
          zoomable
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  )
}
