import { memo } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { StitchNodeProps } from './types'

export interface LabelNodeData {
  kind: 'annotation_label'
  text: string
  fontSize?: number
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
}

export const LabelNode = memo(function LabelNode({ data, selected }: StitchNodeProps) {
  const d = data as unknown as LabelNodeData
  return (
    <div
      data-testid="label-node"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: d.textAlign === 'center' ? 'center' : d.textAlign === 'right' ? 'flex-end' : 'flex-start',
        fontSize: d.fontSize ?? 14,
        color: d.fontColor ?? '#e2e8f0',
        padding: 8,
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer minWidth={60} minHeight={24} isVisible={selected} />
      {d.text || 'Label'}
    </div>
  )
})
