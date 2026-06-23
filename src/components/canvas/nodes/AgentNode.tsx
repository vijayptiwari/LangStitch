import { Bot } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function AgentNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'agent') return null

  const subtitle =
    data.connectionType === 'a2a'
      ? 'A2A remote agent'
      : data.connectionType === 'remote'
        ? 'Remote agent'
        : data.connectionType === 'subagent'
          ? 'Local sub-agent'
          : data.agentRegistryId
            ? 'Registry agent'
            : 'Configure agent…'

  const target =
    data.connectionType === 'a2a'
      ? data.a2aAgentId || 'unset'
      : data.connectionType === 'remote'
        ? data.remoteAgentId || 'unset'
        : data.connectionType === 'subagent'
          ? data.subgraphId || 'unset'
          : data.agentRegistryId || 'unset'

  return (
    <BaseNodeShell kind="agent" title={data.label} subtitle={subtitle} selected={selected}>
      <div className="graph-node__meta-row">
        <Bot size={12} />
        <span className="graph-node__key">{target}</span>
      </div>
      {data.delegateTools && (
        <div className="graph-node__chip graph-node__chip--teal">Tools delegated</div>
      )}
    </BaseNodeShell>
  )
}
