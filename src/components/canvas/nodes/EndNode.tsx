import { BaseNodeShell } from './BaseNode'
import type { StitchNodeProps } from './types'

export function EndNode({ data, selected }: StitchNodeProps) {
  return (
    <BaseNodeShell
      kind="end"
      title={data.label}
      subtitle="Graph exit · END"
      selected={selected}
      showSource={false}
    />
  )
}
