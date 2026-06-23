import { ChevronRight, ZoomOut } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { MAIN_GRAPH_ID } from '../../lib/subgraphCanvas'

export function SubgraphNavigator() {
  const document = useGraphStore((s) => s.document)
  const navigationPath = useGraphStore((s) => s.navigationPath)
  const navigateToGraph = useGraphStore((s) => s.navigateToGraph)
  const zoomOutSubgraph = useGraphStore((s) => s.zoomOutSubgraph)

  const canZoomOut = navigationPath.length > 1

  return (
    <div className="subgraph-nav">
      <div className="subgraph-breadcrumbs">
        {navigationPath.map((graphId, idx) => {
          const sg = document.subgraphs.find((s) => s.id === graphId)
          const label = sg?.name ?? (graphId === MAIN_GRAPH_ID ? 'Main' : graphId)
          const isLast = idx === navigationPath.length - 1
          return (
            <span key={graphId} className="subgraph-crumb-wrap">
              {idx > 0 && <ChevronRight size={12} className="subgraph-crumb-sep" />}
              <button
                type="button"
                className={`subgraph-crumb ${isLast ? 'active' : ''}`}
                onClick={() => !isLast && navigateToGraph(graphId)}
                disabled={isLast}
              >
                {label}
              </button>
            </span>
          )
        })}
      </div>
      {canZoomOut && (
        <button type="button" className="subgraph-zoom-out" onClick={zoomOutSubgraph} title="Zoom out to parent graph">
          <ZoomOut size={14} />
          Zoom out
        </button>
      )}
    </div>
  )
}
