import { Settings2 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { SubgraphNavigator } from './SubgraphNavigator'

export function CanvasToolbar() {
  const setDesignerTab = useGraphStore((s) => s.setDesignerTab)
  const selectNode = useGraphStore((s) => s.selectNode)
  const document = useGraphStore((s) => s.document)
  const activeSg = document.subgraphs.find((s) => s.id === document.activeSubgraphId)

  return (
    <div className="canvas-toolbar">
      <SubgraphNavigator />
      <span className="canvas-toolbar-label">Graph Designer Canvas</span>
      <span className="canvas-toolbar-name">{activeSg?.name ?? document.name}</span>
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
