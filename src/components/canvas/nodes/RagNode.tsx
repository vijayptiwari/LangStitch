import type { RagNodeData } from '../../../types/graph'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function RagNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'rag') return null
  const rag = data as RagNodeData
  return (
    <BaseNodeShell
      kind="rag"
      title={data.label}
      subtitle="RAG pipeline"
      selected={selected}
    >
      <div className="graph-node__meta">
        <span>Pipeline: {rag.pipelineId || 'unset'}</span>
        <span>Mode: vector / vectorless / hybrid</span>
      </div>
    </BaseNodeShell>
  )
}
