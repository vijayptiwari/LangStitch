import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { Toolbar } from './Toolbar'
import { NodePalette } from '../panels/NodePalette'
import { DesignerPanel } from '../designer/DesignerPanel'
import { PlatformDrawer } from '../platform/PlatformDrawer'
import { IdeLayout } from '../ide/IdeLayout'
import { CodeEditorView } from '../code/CodeEditorView'
import { useGraphStore } from '../../store/graphStore'
import { useIdeStore } from '../../store/ideStore'
import { createNodeData, nodeTypes, DRAG_MIME } from '../../lib/nodeRegistry'
import { runGraphMode } from '../../lib/runGraph'
import { exportGraphDocument } from '../../lib/codegen/pythonGenerator'
import type { NodeKind } from '../../types/graph'

export function AppLayout() {
  const addNode = useGraphStore((s) => s.addNode)
  const placeCustomNode = useGraphStore((s) => s.placeCustomNode)
  const isGraphEmpty = useGraphStore((s) => s.isGraphEmpty)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [designerCollapsed, setDesignerCollapsed] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [platformInitialTab, setPlatformInitialTab] = useState<
    'git' | 'export' | 'import' | 'versions' | 'build' | 'deploy' | 'eval' | undefined
  >()
  // Mirror store-driven platform requests (Project menu, Evaluator panel) into
  // the local drawer state so existing keyboard shortcuts keep working too.
  const platformTab = useIdeStore((s) => s.platformTab)
  const closePlatform = useIdeStore((s) => s.closePlatform)
  const openPlatform = useIdeStore((s) => s.openPlatform)
  const setViewMode = useIdeStore((s) => s.setViewMode)
  const setCommandPaletteOpen = useIdeStore((s) => s.setCommandPaletteOpen)
  const setQuickOpenOpen = useIdeStore((s) => s.setQuickOpenOpen)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  useEffect(() => {
    if (platformTab) {
      setPlatformInitialTab(platformTab)
      setPlatformOpen(true)
    }
  }, [platformTab])

  // Bridge the desktop native menu (File/View/Project/Help) into renderer
  // actions. The Electron main process posts `{ type: 'menu', action }` messages.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; action?: string } | null
      if (msg?.type !== 'menu' || !msg.action) return
      switch (msg.action) {
        case 'build':
          void runGraphMode('build')
          break
        case 'run':
          void runGraphMode('run')
          break
        case 'debug':
          void runGraphMode('debug')
          break
        case 'test':
          void runGraphMode('test')
          break
        case 'export':
          openPlatform('export')
          break
        case 'version':
          openPlatform('versions')
          break
        case 'settings':
          setViewMode('canvas')
          setDesignerCollapsed(false)
          break
        case 'view-canvas':
          setViewMode('canvas')
          break
        case 'view-code':
          setViewMode('code')
          break
        case 'command-palette':
          setCommandPaletteOpen(true)
          break
        case 'quick-open':
          setQuickOpenOpen(true)
          break
        case 'terminal':
          setBottomPanel('terminal')
          break
        case 'save': {
          const payload = getProjectPayload()
          const json = exportGraphDocument(
            payload.document,
            payload.nodes,
            payload.edges,
            payload.canvasByGraph,
            payload.navigationPath,
          )
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${payload.document.name || 'graph'}.langstitch.json`
          a.click()
          URL.revokeObjectURL(url)
          break
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [
    openPlatform,
    setViewMode,
    setCommandPaletteOpen,
    setQuickOpenOpen,
    setBottomPanel,
    getProjectPayload,
  ])

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
      // cycle 523 — Ctrl+Shift+P opens Platform Eval tab
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'p' &&
        !e.altKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 583 — Alt+Shift+D opens Platform Eval tab (Alt+D reserved for palette search)
      if (
        e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'd' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 643 — Ctrl+Shift+E opens Platform Eval tab
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'e' &&
        !e.altKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 763 — Alt+Shift+E opens Platform Eval tab (Alt+E reserved for duplicate/palette)
      if (
        e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'e' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 703 — Ctrl+H opens Platform Eval tab when no node selected (duplicate when node selected)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'h' &&
        !e.shiftKey &&
        !e.altKey &&
        !selectedNodeId
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformInitialTab('eval')
          setPlatformOpen(true)
        }
      }
      // cycle 655 — Alt+Shift+K toggles Platform drawer (Alt+L reserved for palette search)
      if (
        e.altKey &&
        e.shiftKey &&
        e.key.toLowerCase() === 'k' &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformOpen((open) => !open)
        }
      }
      // cycle 775 — Ctrl+Shift+O toggles Platform drawer (Ctrl+P reserved for graph name focus)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'o' &&
        !e.altKey
      ) {
        e.preventDefault()
        if (!isGraphEmpty()) {
          setPlatformOpen((open) => !open)
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
      </a>
      <Toolbar />
      <IdeLayout codeView={<CodeEditorView />}>
        <div
          className="workspace"
          style={{
            gridTemplateColumns: `${paletteCollapsed ? '40px' : '264px'} 1fr ${
              designerCollapsed ? '40px' : '360px'
            }`,
          }}
        >
          {paletteCollapsed ? (
            <button
              type="button"
              className="panel-rail panel-rail-left"
              data-testid="expand-palette"
              title="Show node library"
              onClick={() => setPaletteCollapsed(false)}
            >
              <PanelLeftOpen size={18} />
              <span className="panel-rail-label">Node Library</span>
            </button>
          ) : (
            <aside className="sidebar left">
              <div className="panel-collapse-head">
                <span className="panel-collapse-title">Node Library</span>
                <button
                  type="button"
                  className="panel-collapse-btn"
                  data-testid="collapse-palette"
                  title="Collapse node library"
                  onClick={() => setPaletteCollapsed(true)}
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
              <NodePalette />
            </aside>
          )}
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
          {designerCollapsed ? (
            <button
              type="button"
              className="panel-rail panel-rail-right"
              data-testid="expand-designer"
              title="Show properties"
              onClick={() => setDesignerCollapsed(false)}
            >
              <PanelRightOpen size={18} />
              <span className="panel-rail-label">Properties</span>
            </button>
          ) : (
            <div className="designer-wrap">
              <button
                type="button"
                className="panel-collapse-btn designer-collapse-btn"
                data-testid="collapse-designer"
                title="Collapse properties"
                onClick={() => setDesignerCollapsed(true)}
              >
                <PanelRightClose size={16} />
              </button>
              <DesignerPanel />
            </div>
          )}
        </div>
      </IdeLayout>
      <PlatformDrawer
        open={platformOpen}
        onClose={() => {
          setPlatformOpen(false)
          setPlatformInitialTab(undefined)
          closePlatform()
        }}
        initialTab={platformInitialTab}
      />
    </div>
  )
}
