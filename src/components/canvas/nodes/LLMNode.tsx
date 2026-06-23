import { Sparkles } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function LLMNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'llm') return null
  return (
    <BaseNodeShell
      kind="llm"
      title={data.label}
      subtitle={data.model}
      selected={selected}
    >
      <div className="graph-node__meta-row">
        <Sparkles size={12} />
        <span>temp {data.temperature}</span>
        <span className="graph-node__dot">·</span>
        <span className="graph-node__key">→ {data.outputKey}</span>
      </div>
    </BaseNodeShell>
  )
}
