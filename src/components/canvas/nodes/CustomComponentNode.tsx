import { memo, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'
import { useGraphStore } from '../../../store/graphStore'
import { resolveComponent } from '../../../lib/customComponents'
import { getNodeTheme, getThemeForNode } from '../../../lib/nodeTheme'

function evenTops(count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return ['50%']
  return Array.from({ length: count }, (_, i) => `${((i + 1) / (count + 1)) * 100}%`)
}

export const CustomComponentNode = memo(function CustomComponentNode({
  id,
  data,
  selected,
}: StitchNodeProps) {
  const registry = useGraphStore((s) => s.document.componentRegistry)
  const componentId = data.kind === 'custom' ? data.componentId : ''
  const manifest = useMemo(
    () => resolveComponent(registry, componentId),
    [registry, componentId],
  )

  if (data.kind !== 'custom') return null

  if (!manifest) {
    const base = getNodeTheme('custom')
    return (
      <div data-testid="custom-node-missing">
        <BaseNodeShell
          kind="custom"
          title={data.label || 'Missing component'}
          subtitle={data.componentId}
          selected={selected}
          theme={{ ...base, color: '#f59e0b', colorLight: '#fcd34d', icon: AlertTriangle }}
        >
          <div className="graph-node__meta-row">
            <span className="graph-node__key">Component removed from project</span>
          </div>
        </BaseNodeShell>
      </div>
    )
  }

  const theme = getThemeForNode({ id, data, position: { x: 0, y: 0 } }, registry)
  const leftPorts = manifest.ports.filter((p) => p.side === 'left')
  const rightPorts = manifest.ports.filter((p) => p.side === 'right')
  const leftTops = evenTops(leftPorts.length)
  const rightTops = evenTops(rightPorts.length)

  const summaryField = manifest.configFields[0]
  const summaryValue = summaryField ? data.config?.[summaryField.id] : undefined

  return (
    <div data-testid={`custom-node-${manifest.id}`}>
      <BaseNodeShell
        kind="custom"
        title={data.label || manifest.label}
        subtitle={manifest.category !== 'node' ? manifest.category : undefined}
        selected={selected}
        theme={theme}
        showTarget={leftPorts.length === 0}
        showSource={rightPorts.length === 0}
        targetHandles={leftPorts.map((p, i) => ({ id: p.id, label: p.label, top: leftTops[i] }))}
        sourceHandles={rightPorts.map((p, i) => ({ id: p.id, label: p.label, top: rightTops[i] }))}
      >
        {summaryField && summaryValue !== undefined && summaryValue !== '' && (
          <div className="graph-node__meta-row">
            <span className="graph-node__key">
              {summaryField.label}: {String(summaryValue).slice(0, 28)}
            </span>
          </div>
        )}
      </BaseNodeShell>
    </div>
  )
})
