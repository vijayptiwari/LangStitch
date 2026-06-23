import { Box, GitBranch } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { NodeDesigner } from './NodeDesigner'
import { GraphDesigner } from './GraphDesigner'

export function DesignerPanel() {
  const designerTab = useGraphStore((s) => s.designerTab)
  const setDesignerTab = useGraphStore((s) => s.setDesignerTab)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  return (
    <aside className="designer-sidebar" data-testid="designer-panel">
      <nav className="designer-tabs">
        <button
          type="button"
          data-testid="designer-tab-node"
          className={`designer-tab ${designerTab === 'node' ? 'active' : ''}`}
          onClick={() => setDesignerTab('node')}
        >
          <Box size={14} />
          Node Designer
          {selectedNodeId && <span className="designer-tab-dot" />}
        </button>
        <button
          type="button"
          data-testid="designer-tab-graph"
          className={`designer-tab ${designerTab === 'graph' ? 'active' : ''}`}
          onClick={() => setDesignerTab('graph')}
        >
          <GitBranch size={14} />
          Graph Designer
        </button>
      </nav>
      {designerTab === 'node' ? <NodeDesigner /> : <GraphDesigner />}
    </aside>
  )
}
