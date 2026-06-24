import { Grid3x3, Settings2 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { DEFAULT_GRAPH_SETTINGS } from '../../lib/designerConstants'
import { SubgraphNavigator } from './SubgraphNavigator'

export function CanvasToolbar() {
  const setDesignerTab = useGraphStore((s) => s.setDesignerTab)
  const selectNode = useGraphStore((s) => s.selectNode)
  const document = useGraphStore((s) => s.document)
  const updateGraphSettings = useGraphStore((s) => s.updateGraphSettings)
  const activeSg = document.subgraphs.find((s) => s.id === document.activeSubgraphId)
  const snapToGrid = document.settings?.snapToGrid ?? DEFAULT_GRAPH_SETTINGS.snapToGrid

  return (
    <div className="canvas-toolbar">
      <SubgraphNavigator />
      <span className="canvas-toolbar-label">Graph Designer Canvas</span>
      <span className="canvas-toolbar-name">{activeSg?.name ?? document.name}</span>
      <button
        type="button"
        className={`canvas-toolbar-btn ${snapToGrid ? 'active' : ''}`}
        data-testid="canvas-snap-toggle"
        title="Snap nodes to grid"
        aria-pressed={snapToGrid}
        onClick={() => updateGraphSettings({ snapToGrid: !snapToGrid })}
      >
        <Grid3x3 size={14} />
        Snap to grid
      </button>
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={() => {
          selectNode(null)
          setDesignerTab('graph')
        }}
      >
        <Settings2 size={14} />
        Graph properties
      </button>
    </div>
  )
}
