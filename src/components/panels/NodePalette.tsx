import { useCallback } from 'react'
import { paletteItems } from '../../lib/nodeRegistry'
import { NODE_THEMES } from '../../lib/nodeTheme'
import { useGraphStore } from '../../store/graphStore'
import type { NodeKind } from '../../types/graph'
import { createNodeData, nodeTypes, DRAG_MIME } from '../../lib/nodeRegistry'
import { customPaletteItems, resolveIcon } from '../../lib/customComponents'

function randomDropPosition() {
  return { x: 200 + Math.random() * 200, y: 120 + Math.random() * 200 }
}

export function NodePalette() {
  const addNode = useGraphStore((s) => s.addNode)
  const componentRegistry = useGraphStore((s) => s.document.componentRegistry)
  const placeCustomNode = useGraphStore((s) => s.placeCustomNode)
  const customItems = customPaletteItems(componentRegistry)

  const onDragStart = useCallback((event: React.DragEvent, kind: NodeKind) => {
    event.dataTransfer.setData(DRAG_MIME, kind)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragStartCustom = useCallback((event: React.DragEvent, componentId: string) => {
    event.dataTransfer.setData(DRAG_MIME, `custom:${componentId}`)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleQuickAdd = (kind: NodeKind) => {
    const id = `${kind}-${Date.now().toString(36)}`
    addNode({
      id,
      type: nodeTypes[kind],
      position: randomDropPosition(),
      data: createNodeData(kind),
    })
  }

  return (
    <div className="panel" data-testid="node-palette">
      <h3 className="panel-title">Node Library</h3>
      <p className="panel-subtitle">Drag onto canvas or click to add — each type has a distinct color</p>
      <div className="palette-list">
        {paletteItems.map((item) => {
          const theme = NODE_THEMES[item.kind]
          const Icon = theme.icon
          return (
            <button
              key={item.kind}
              className="palette-item"
              data-testid={`palette-${item.kind}`}
              style={
                {
                  '--palette-accent': theme.color,
                  '--palette-bg': `${theme.color}22`,
                } as React.CSSProperties
              }
              draggable
              onDragStart={(e) => onDragStart(e, item.kind)}
              onClick={() => handleQuickAdd(item.kind)}
              type="button"
            >
              <div className="palette-item-icon">
                <Icon size={18} strokeWidth={2.25} />
              </div>
              <div>
                <div className="palette-item-label">{item.label}</div>
                <div className="palette-item-desc">{item.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {customItems.length > 0 && (
        <>
          <h3 className="panel-title" data-testid="palette-custom-group">
            Custom Components
          </h3>
          <p className="panel-subtitle">Authored in the Components designer tab</p>
          <div className="palette-list">
            {customItems.map((item) => {
              const Icon = resolveIcon(item.icon)
              return (
                <button
                  key={item.componentId}
                  className="palette-item"
                  data-testid={`palette-custom-${item.componentId}`}
                  style={
                    {
                      '--palette-accent': item.color,
                      '--palette-bg': `${item.color}22`,
                    } as React.CSSProperties
                  }
                  draggable
                  onDragStart={(e) => onDragStartCustom(e, item.componentId)}
                  onClick={() => placeCustomNode(item.componentId, randomDropPosition())}
                  type="button"
                >
                  <div className="palette-item-icon">
                    <Icon size={18} strokeWidth={2.25} />
                  </div>
                  <div>
                    <div className="palette-item-label">{item.label}</div>
                    <div className="palette-item-desc">{item.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
