import type { RouterNodeData } from '../../../types/graph'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function RouterNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'router') return null
  const routerData = data as RouterNodeData
  const handles = routerData.branches.map((b, i) => ({
    id: b.id,
    label: b.label,
    top: `${((i + 1) / (routerData.branches.length + 1)) * 100}%`,
  }))

  return (
    <BaseNodeShell
      kind="router"
      title={data.label}
      subtitle="Conditional routing"
      selected={selected}
      showSource={false}
      sourceHandles={handles}
    >
      <div className="graph-node__branches">
        {routerData.branches.map((b) => (
          <div key={b.id} className="graph-node__branch">
            <span className="graph-node__branch-dot" />
            {b.label}
          </div>
        ))}
      </div>
    </BaseNodeShell>
  )
}
