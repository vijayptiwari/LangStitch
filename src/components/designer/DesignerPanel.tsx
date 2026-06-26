import { Box, GitBranch, Puzzle, Sparkles } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { NodeDesigner } from './NodeDesigner'
import { GraphDesigner } from './GraphDesigner'
import { AssetDesignersPanel } from './AssetDesignersPanel'
import { ComponentDesignerPanel } from './ComponentDesignerPanel'

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
          Node
          {selectedNodeId && <span className="designer-tab-dot" />}
        </button>
        <button
          type="button"
          data-testid="designer-tab-graph"
          className={`designer-tab ${designerTab === 'graph' ? 'active' : ''}`}
          onClick={() => setDesignerTab('graph')}
        >
          <GitBranch size={14} />
          Graph
        </button>
        <button
          type="button"
          data-testid="designer-tab-assets"
          className={`designer-tab ${designerTab === 'assets' ? 'active' : ''}`}
          onClick={() => setDesignerTab('assets')}
        >
          <Sparkles size={14} />
          Assets
        </button>
        <button
          type="button"
          data-testid="designer-tab-components"
          className={`designer-tab ${designerTab === 'components' ? 'active' : ''}`}
          onClick={() => setDesignerTab('components')}
        >
          <Puzzle size={14} />
          Components
        </button>
      </nav>
      {designerTab === 'node' && <NodeDesigner />}
      {designerTab === 'graph' && <GraphDesigner />}
      {designerTab === 'assets' && <AssetDesignersPanel />}
      {designerTab === 'components' && <ComponentDesignerPanel />}
    </aside>
  )
}
