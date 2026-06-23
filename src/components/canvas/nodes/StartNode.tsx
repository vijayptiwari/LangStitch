import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function StartNode({ data, selected }: StitchNodeProps) {
  return (
    <BaseNodeShell
      kind="start"
      title={data.label}
      subtitle="Graph entry · START"
      selected={selected}
      showTarget={false}
    />
  )
}
