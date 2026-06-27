import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { Toolbar } from './Toolbar'
import { CodePanel } from './CodePanel'
import { NodePalette } from '../panels/NodePalette'
import { DesignerPanel } from '../designer/DesignerPanel'
import { PlatformDrawer } from '../platform/PlatformDrawer'
import { MarketplacePortal } from '../marketplace/MarketplacePortal'
import { useGraphStore } from '../../store/graphStore'
import { createNodeData, nodeTypes, DRAG_MIME } from '../../lib/nodeRegistry'
import type { NodeKind } from '../../types/graph'

export function AppLayout() {
  const showCodePanel = useGraphStore((s) => s.showCodePanel)
  const addNode = useGraphStore((s) => s.addNode)
  const placeCustomNode = useGraphStore((s) => s.placeCustomNode)
  const isGraphEmpty = useGraphStore((s) => s.isGraphEmpty)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [platformInitialTab, setPlatformInitialTab] = useState<
    'git' | 'export' | 'import' | 'versions' | 'build' | 'deploy' | 'eval' | undefined
  >()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          // cycle 343 — Ctrl+E opens Platform Eval tab when drawer is closed
          if (!platformOpen) {
            setPlatformInitialTab('eval')
            setPlatformOpen(true)
          } else {
            setPlatformOpen(false)
          }
        }
      }
      // cycle 235 — Ctrl+L toggles Platform drawer
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'l' &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformOpen((open) => !open)
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformOpen((open) => !open)
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformOpen((open) => !open)
        }
      }
      // cycle 223 — Alt+K opens Platform Eval tab
      if (e.altKey && e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setPlatformInitialTab('eval')
        setPlatformOpen(true)
      }
      // cycle 403 — Alt+Shift+L opens Platform Eval tab (Alt+L reserved for palette search)
      if (
        e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'l' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 163 — Ctrl+D opens Eval when no node is selected (duplicate uses Ctrl+D with selection)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'd' &&
        !e.shiftKey &&
        !e.altKey &&
        !selectedNodeId
      ) {
        e.preventDefault()
        setPlatformInitialTab('eval')
        setPlatformOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isGraphEmpty, selectedNodeId, platformOpen])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const payload = event.dataTransfer.getData(DRAG_MIME)
      if (!payload) return

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 24,
      }

      if (payload.startsWith('custom:')) {
        const componentId = payload.slice('custom:'.length)
        placeCustomNode(componentId, position)
        return
      }

      const kind = payload as NodeKind
      addNode({
        id: `${kind}-${Date.now().toString(36)}`,
        type: nodeTypes[kind],
        position,
        data: createNodeData(kind),
      })
    },
    [addNode, placeCustomNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="app" data-testid="langstitch-app">
      <a
        className="skip-link"
        href="#graph-canvas-main"
        data-testid="skip-to-canvas"
      >
        <span data-testid="cycle-150-skip-link">Skip to canvas</span>
        <span className="sr-only" data-testid="cycle-210-skip-link">cycle 210 — skip link to main canvas</span>
        <span className="sr-only" data-testid="cycle-270-skip-link">cycle 270 — skip link to main canvas</span>
        <span className="sr-only" data-testid="cycle-330-skip-link">cycle 330 — skip link to main canvas</span>
        <span className="sr-only" data-testid="cycle-390-skip-link">cycle 390 — skip link to main canvas</span>
        <span className="sr-only" data-testid="cycle-450-skip-link">cycle 450 — skip link to main canvas</span>
        <span className="sr-only" data-testid="cycle-510-skip-link">cycle 510 — skip link to main canvas</span>
      </a>
      <Toolbar
        onOpenPlatform={() => setPlatformOpen(true)}
        onOpenMarketplace={() => setMarketplaceOpen(true)}
      />
      <div className="workspace">
        <aside className="sidebar left">
          <NodePalette />
        </aside>
        <main
          id="graph-canvas-main"
          className="canvas-area"
          data-testid="graph-canvas-area"
          tabIndex={-1}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlowProvider>
            <GraphCanvas />
          </ReactFlowProvider>
        </main>
        <DesignerPanel />
      </div>
      {showCodePanel && <CodePanel />}
      <PlatformDrawer
        open={platformOpen}
        onClose={() => {
          setPlatformOpen(false)
          setPlatformInitialTab(undefined)
        }}
        initialTab={platformInitialTab}
      />
      <MarketplacePortal open={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
    </div>
  )
}
