import { memo } from 'react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import type { StitchNodeProps } from './types'

export interface ScopeNodeData {
  kind: 'scope'
  label: string
  subgraphId?: string
}

export const ScopeNode = memo(function ScopeNode({ data, selected }: StitchNodeProps) {
  const d = data as unknown as ScopeNodeData
  return (
    <div
      data-testid="scope-node"
      className="scope-node"
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(71,85,105,0.12)',
        border: '2px dashed rgba(148,163,184,0.5)',
        borderRadius: 12,
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer minWidth={200} minHeight={160} isVisible={selected} />
      <Handle type="target" position={Position.Left} id="scope_in" style={{ left: -6 }} />
      <Handle type="source" position={Position.Right} id="scope_out" style={{ right: -6 }} />
      <div style={{ position: 'absolute', top: 8, left: 12, fontSize: 12, fontWeight: 600, opacity: 0.8 }}>
        {d.label || 'Scope'}
      </div>
    </div>
  )
})
