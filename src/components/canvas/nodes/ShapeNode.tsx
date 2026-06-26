import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { StitchNodeProps } from './types'

export interface ShapeNodeData {
  kind: 'annotation_shape'
  shape: 'rect' | 'ellipse'
  label?: string
  fill?: string
  stroke?: string
  opacity?: number
  cornerRadius?: number
}

export const ShapeNode = memo(function ShapeNode({ id, data, selected }: StitchNodeProps) {
  const d = data as unknown as ShapeNodeData
  const isEllipse = d.shape === 'ellipse'
  return (
    <div
      data-testid={`shape-node-${id}`}
      style={{
        width: '100%',
        height: '100%',
        background: d.fill ?? 'rgba(99,102,241,0.08)',
        border: `2px solid ${d.stroke ?? 'rgba(99,102,241,0.35)'}`,
        borderRadius: isEllipse ? '50%' : d.cornerRadius ?? 8,
        opacity: d.opacity ?? 1,
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer minWidth={80} minHeight={48} isVisible={selected} />
      {d.label && (
        <span style={{ position: 'absolute', top: 4, left: 8, fontSize: 11, opacity: 0.7 }}>
          {d.label}
        </span>
      )}
    </div>
  )
})
