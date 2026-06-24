import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { Toolbar } from './Toolbar'
import { CodePanel } from './CodePanel'
import { NodePalette } from '../panels/NodePalette'
import { DesignerPanel } from '../designer/DesignerPanel'
import { PlatformDrawer } from '../platform/PlatformDrawer'
import { useGraphStore } from '../../store/graphStore'
import { createNodeData, nodeTypes, DRAG_MIME } from '../../lib/nodeRegistry'
import type { NodeKind } from '../../types/graph'

export function AppLayout() {
  const showCodePanel = useGraphStore((s) => s.showCodePanel)
  const addNode = useGraphStore((s) => s.addNode)
  const [platformOpen, setPlatformOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setPlatformOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(DRAG_MIME) as NodeKind
      if (!kind) return

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 24,
      }

      addNode({
        id: `${kind}-${Date.now().toString(36)}`,
        type: nodeTypes[kind],
        position,
        data: createNodeData(kind),
      })
    },
    [addNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="app" data-testid="langstitch-app">
      <Toolbar onOpenPlatform={() => setPlatformOpen(true)} />
      <div className="workspace">
        <aside className="sidebar left">
          <NodePalette />
        </aside>
        <main className="canvas-area" data-testid="graph-canvas-area" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlowProvider>
            <GraphCanvas />
          </ReactFlowProvider>
        </main>
        <DesignerPanel />
      </div>
      {showCodePanel && <CodePanel />}
      <PlatformDrawer open={platformOpen} onClose={() => setPlatformOpen(false)} />
    </div>
  )
}
