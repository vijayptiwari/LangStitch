import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function FunctionNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'function') return null
  return (
    <BaseNodeShell
      kind="function"
      title={data.label}
      subtitle={data.functionName}
      selected={selected}
    >
      <div className="graph-node__meta-row">
        <span className="graph-node__key">→ {data.outputKey}</span>
      </div>
    </BaseNodeShell>
  )
}
