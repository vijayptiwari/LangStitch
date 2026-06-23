import { Handle, Position } from '@xyflow/react'
import type { NodeKind } from '../../../types/graph'
import { getNodeTheme } from '../../../lib/nodeTheme'
import type { LGNodeData } from '../../../types/graph'

export type LGNodeProps = {
  id: string
  data: LGNodeData
  selected?: boolean
}

interface SourceHandle {
  id: string
  label: string
  top: string
}

export function BaseNodeShell({
  kind,
  title,
  subtitle,
  selected = false,
  children,
  showTarget = true,
  showSource = true,
  sourceHandles,
}: {
  kind: NodeKind
  title: string
  subtitle?: string
  selected?: boolean
  children?: React.ReactNode
  showTarget?: boolean
  showSource?: boolean
  sourceHandles?: SourceHandle[]
}) {
  const theme = getNodeTheme(kind)
  const Icon = theme.icon

  return (
    <div
      className={`graph-node graph-node--${kind}${selected ? ' graph-node--selected' : ''}`}
      style={
        {
          '--node-color': theme.color,
          '--node-color-light': theme.colorLight,
          '--node-glow': theme.glow,
          '--node-gradient': theme.gradient,
        } as React.CSSProperties
      }
    >
      <div className="graph-node__shine" aria-hidden />
      <div className="graph-node__accent-bar" aria-hidden />

      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="graph-handle graph-handle--target"
        />
      )}

      <div className="graph-node__header">
        <div className="graph-node__icon-wrap">
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div className="graph-node__titles">
          <span className="graph-node__badge">{theme.typeLabel}</span>
          <div className="graph-node__title">{title}</div>
          {subtitle && <div className="graph-node__subtitle">{subtitle}</div>}
        </div>
      </div>

      {children && <div className="graph-node__body">{children}</div>}

      {sourceHandles?.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Right}
          className="graph-handle graph-handle--source"
          style={{ top: h.top }}
          title={h.label}
        />
      ))}

      {showSource && !sourceHandles?.length && (
        <Handle type="source" position={Position.Right} className="graph-handle graph-handle--source" />
      )}
    </div>
  )
}
