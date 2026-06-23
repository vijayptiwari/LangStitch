import { Globe, Link2 } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function SubgraphNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'subgraph') return null
  const isRemote = data.connectionType === 'remote'
  const connected = isRemote
    ? Boolean(data.remoteGraphId || data.remoteEndpoint)
    : Boolean(data.subgraphId)

  return (
    <BaseNodeShell
      kind="subgraph"
      title={data.label}
      subtitle={
        isRemote
          ? 'Remote graph connection'
          : data.subgraphId
            ? 'Double-click to open subgraph'
            : 'Select subgraph…'
      }
      selected={selected}
    >
      <div className="graph-node__meta-row">
        {isRemote ? <Globe size={12} /> : <Link2 size={12} />}
        <span className="graph-node__key">
          {isRemote
            ? data.remoteGraphId || data.remoteEndpoint || 'Unconnected'
            : data.subgraphId || 'Unconnected'}
        </span>
      </div>
      {connected && !isRemote && (
        <div className="graph-node__hint">↳ drill in</div>
      )}
    </BaseNodeShell>
  )
}
