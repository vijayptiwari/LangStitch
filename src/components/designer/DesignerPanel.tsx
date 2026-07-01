import { useEffect, useState } from 'react'
import { Box, ChevronDown, GitBranch, Sparkles } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { NodeDesigner } from './NodeDesigner'
import { GraphDesigner } from './GraphDesigner'
import { AssetDesignersPanel } from './AssetDesignersPanel'
import { ComponentDesignerPanel } from './ComponentDesignerPanel'

type SectionId = 'node' | 'graph' | 'assets'

/** Map the store's designerTab (driven by canvas/toolbar) to an accordion section. */
function tabToSection(tab: string): SectionId {
  if (tab === 'node') return 'node'
  if (tab === 'assets' || tab === 'components') return 'assets'
  return 'graph'
}

export function DesignerPanel() {
  const designerTab = useGraphStore((s) => s.designerTab)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectedLabel = useGraphStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId)?.data?.label,
  )

  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    node: true,
    graph: true,
    assets: false,
  })

  // When the canvas selects a node or the toolbar focuses the graph, expand the
  // matching section so the relevant properties are visible immediately.
  useEffect(() => {
    const section = tabToSection(designerTab)
    setOpen((prev) => (prev[section] ? prev : { ...prev, [section]: true }))
  }, [designerTab, selectedNodeId])

  const toggle = (id: SectionId) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <aside className="designer-sidebar" data-testid="designer-panel">
      <div className="designer-accordion">
        <section
          className={`designer-acc-section ${open.node ? 'open' : ''}`}
          data-testid="designer-section-node"
        >
          <button
            type="button"
            className="designer-acc-header"
            aria-expanded={open.node}
            onClick={() => toggle('node')}
            data-testid="designer-section-node-header"
          >
            <ChevronDown size={14} className="designer-acc-chevron" />
            <Box size={14} />
            <span className="designer-acc-title">Node Properties</span>
            {selectedLabel ? (
              <span className="designer-acc-sub">{selectedLabel}</span>
            ) : (
              selectedNodeId && <span className="designer-tab-dot" />
            )}
          </button>
          {open.node && (
            <div className="designer-acc-body">
              <NodeDesigner />
            </div>
          )}
        </section>

        <section
          className={`designer-acc-section ${open.graph ? 'open' : ''}`}
          data-testid="designer-section-graph"
        >
          <button
            type="button"
            className="designer-acc-header"
            aria-expanded={open.graph}
            onClick={() => toggle('graph')}
            data-testid="designer-section-graph-header"
          >
            <ChevronDown size={14} className="designer-acc-chevron" />
            <GitBranch size={14} />
            <span className="designer-acc-title">Graph Properties</span>
          </button>
          {open.graph && (
            <div className="designer-acc-body">
              <GraphDesigner />
            </div>
          )}
        </section>

        <section
          className={`designer-acc-section ${open.assets ? 'open' : ''}`}
          data-testid="designer-section-assets"
        >
          <button
            type="button"
            className="designer-acc-header"
            aria-expanded={open.assets}
            onClick={() => toggle('assets')}
            data-testid="designer-section-assets-header"
          >
            <ChevronDown size={14} className="designer-acc-chevron" />
            <Sparkles size={14} />
            <span className="designer-acc-title">Assets</span>
          </button>
          {open.assets && (
            <div className="designer-acc-body designer-acc-body-stack">
              <AssetDesignersPanel />
              <ComponentDesignerPanel />
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
