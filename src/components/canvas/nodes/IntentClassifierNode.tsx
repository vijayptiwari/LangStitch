import type { IntentClassifierNodeData } from '../../../types/graph'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function IntentClassifierNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'intent_classifier') return null
  const ic = data as IntentClassifierNodeData
  const handles = ic.intents.map((intent, i) => ({
    id: intent.id,
    label: intent.label,
    top: `${((i + 1) / (ic.intents.length + 1)) * 100}%`,
  }))

  return (
    <BaseNodeShell
      kind="intent_classifier"
      title={data.label}
      subtitle={ic.multiIntent ? 'Multi-intent routing' : 'Intent routing'}
      selected={selected}
      showSource={false}
      sourceHandles={handles}
    >
      <div className="graph-node__branches">
        {ic.intents.map((intent) => (
          <div key={intent.id} className="graph-node__branch">
            <span className="graph-node__branch-dot" />
            {intent.label}
          </div>
        ))}
      </div>
    </BaseNodeShell>
  )
}
