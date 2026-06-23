import { Plug, Server } from 'lucide-react'
import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function ToolNode({ data, selected }: StitchNodeProps) {
  if (data.kind !== 'tool') return null

  const conn = data.connectionType ?? 'inline'
  const subtitle =
    conn === 'mcp'
      ? `MCP · ${data.mcpToolName || 'select tool'}`
      : conn === 'registry'
        ? 'Registry tool'
        : data.toolName

  return (
    <BaseNodeShell kind="tool" title={data.label} subtitle={subtitle} selected={selected}>
      <div className="graph-node__meta-row">
        {conn === 'mcp' ? <Plug size={12} /> : <Server size={12} />}
        <span className="graph-node__key">
          {conn === 'mcp'
            ? `${data.mcpServerId || 'mcp'}:${data.mcpToolName || '?'}`
            : conn === 'registry'
              ? data.toolRegistryId || 'unset'
              : data.toolName}
        </span>
      </div>
      <div className="graph-node__chip">{data.toolDescription}</div>
    </BaseNodeShell>
  )
}
