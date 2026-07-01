import { UserCheck } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

const INTERACTION_LABEL: Record<string, string> = {
  approval: 'Approval gate',
  edit: 'Edit & continue',
  input: 'Collect input',
}

export function HitlNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'hitl') return null
  return (
    <BaseNodeShell
      kind="hitl"
      title={data.label}
      subtitle={INTERACTION_LABEL[data.interactionType] ?? data.interactionType}
      selected={selected}
    >
      <div className="graph-node__meta-row">
        <UserCheck size={12} />
        <span>{data.interactionType}</span>
        <span className="graph-node__dot">·</span>
        <span className="graph-node__key">→ {data.outputKey}</span>
      </div>
    </BaseNodeShell>
  )
}
