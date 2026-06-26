import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '../components/canvas/GraphCanvas'
import { NodePalette } from '../components/panels/NodePalette'
import { DesignerPanel } from '../components/designer/DesignerPanel'
import { useGraphStore } from '../store/graphStore'
import { createNodeData, nodeTypes, DRAG_MIME } from '../lib/nodeRegistry'
import type { NodeKind } from '../types/graph'
import { initVsCodeBridge } from './vscodeBridge'
import '../index.css'

function WebviewWorkspace() {
  const addNode = useGraphStore((s) => s.addNode)

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData(DRAG_MIME) as NodeKind
    if (!kind) return
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    addNode({
      id: `${kind}-${Date.now().toString(36)}`,
      type: nodeTypes[kind],
      position: { x: event.clientX - bounds.left - 90, y: event.clientY - bounds.top - 24 },
      data: createNodeData(kind),
    })
  }

  return (
    <div className="app" data-testid="langtailor-canvas">
      <div className="workspace">
        <aside className="sidebar left">
          <NodePalette />
        </aside>
        <main
          className="canvas-area"
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
        >
          <ReactFlowProvider>
            <GraphCanvas />
          </ReactFlowProvider>
        </main>
        <DesignerPanel />
      </div>
    </div>
  )
}

initVsCodeBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebviewWorkspace />
  </StrictMode>,
)
