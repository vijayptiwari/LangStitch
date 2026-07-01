import { Wand2 } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

const TRANSFORM_LABEL: Record<string, string> = {
  template: 'Template',
  expression: 'Expression',
  python: 'Python',
}

export function ResponseTransformerNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'response_transformer') return null
  return (
    <BaseNodeShell
      kind="response_transformer"
      title={data.label}
      subtitle={`${TRANSFORM_LABEL[data.transformType] ?? data.transformType} transform`}
      selected={selected}
    >
      <div className="graph-node__meta-row">
        <Wand2 size={12} />
        <span className="graph-node__key">{data.inputKey}</span>
        <span className="graph-node__dot">→</span>
        <span className="graph-node__key">{data.outputKey}</span>
      </div>
    </BaseNodeShell>
  )
}
