import { Handle, Position, useNodeId } from '@xyflow/react'
import type { NodeKind } from '../../../types/graph'
import { getNodeTheme, type NodeTheme } from '../../../lib/nodeTheme'
import type { StitchNodeData } from '../../../types/graph'
import { useIdeStore } from '../../../store/ideStore'
import { useGraphStore } from '../../../store/graphStore'
import { virtualNodePath } from '../../../lib/codegen/nodeModuleCodegen'
import { firstExecutableLine } from '../../../lib/breakpoints'

export type StitchShellProps = {
  id: string
  data: StitchNodeData
  selected?: boolean
}

interface SourceHandle {
  id: string
  label: string
  top: string
}

interface TargetHandle {
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
  targetHandles,
  theme: themeOverride,
}: {
  kind: NodeKind
  title: string
  subtitle?: string
  selected?: boolean
  children?: React.ReactNode
  showTarget?: boolean
  showSource?: boolean
  sourceHandles?: SourceHandle[]
  targetHandles?: TargetHandle[]
  theme?: NodeTheme
}) {
  const theme = themeOverride ?? getNodeTheme(kind)
  const Icon = theme.icon

  const nodeId = useNodeId()
  // Breakpoints only apply to executable graph nodes (not start/end).
  const isExecutable = !!nodeId && kind !== 'start' && kind !== 'end'
  const document = useGraphStore((s) => s.document)
  const filePath = isExecutable ? virtualNodePath(document, nodeId) : null
  const hasBreakpoint = useIdeStore((s) =>
    filePath ? (s.breakpoints[filePath]?.length ?? 0) > 0 : false,
  )
  const isDebugActive = useIdeStore((s) => !!nodeId && s.debugNodeId === nodeId)

  const onToggleBreakpoint = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!filePath) return
    const ide = useIdeStore.getState()
    if ((ide.breakpoints[filePath]?.length ?? 0) > 0) {
      ide.setBreakpoints(filePath, [])
    } else {
      const content = ide.virtualFiles[filePath]
      const line = content ? firstExecutableLine(content) : 1
      ide.toggleBreakpoint(filePath, line)
    }
  }

  return (
    <div
      className={`graph-node graph-node--${kind}${selected ? ' graph-node--selected' : ''}${
        hasBreakpoint ? ' graph-node--breakpoint' : ''
      }${isDebugActive ? ' graph-node--debugging' : ''}`}
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

      {isExecutable && (
        <button
          type="button"
          className={`graph-node__bp${hasBreakpoint ? ' active' : ''}`}
          title={hasBreakpoint ? 'Remove breakpoint (synced to code)' : 'Add breakpoint (synced to code)'}
          aria-label="Toggle breakpoint"
          onClick={onToggleBreakpoint}
        />
      )}

      {targetHandles?.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="target"
          position={Position.Left}
          className="graph-handle graph-handle--target"
          style={{ top: h.top }}
          title={h.label}
        />
      ))}

      {showTarget && !targetHandles?.length && (
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
