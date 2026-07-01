import type { StitchNodeData } from '../types/graph'

const DEFAULT_STUB = 'return {}'

/** Read editable implementation code from any node kind. */
export function getNodeCode(data: StitchNodeData): string {
  if (data.kind === 'function') return data.code?.trim() ? data.code : DEFAULT_STUB
  const custom = (data as { customCode?: string }).customCode
  return custom?.trim() ? custom : DEFAULT_STUB
}

/** Write implementation code back onto node data. */
export function setNodeCode(data: StitchNodeData, code: string): StitchNodeData {
  if (data.kind === 'function') return { ...data, code }
  return { ...data, customCode: code }
}

/** True when the node carries user-authored code beyond the default stub. */
export function hasCustomCode(data: StitchNodeData): boolean {
  const code = getNodeCode(data).trim()
  if (!code || code === DEFAULT_STUB.trim()) return false
  return code !== 'return {}'
}
