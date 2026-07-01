import type { StitchNodeData } from '../types/graph'
import { hasCustomCode } from './nodeCode'

export interface DeletionConfirmRequest {
  nodeId: string
  label: string
  kind: string
}

export type ConfirmDeletionFn = (req: DeletionConfirmRequest) => Promise<boolean>

let confirmHandler: ConfirmDeletionFn | null = null

export function setDeletionConfirmHandler(fn: ConfirmDeletionFn | null): void {
  confirmHandler = fn
}

/** Returns true if removal should proceed. */
export async function confirmNodeDeletion(
  nodeId: string,
  data: StitchNodeData,
): Promise<boolean> {
  if (!hasCustomCode(data)) return true
  if (!confirmHandler) {
    return window.confirm(
      `Node "${data.label}" contains custom code that will be lost. Delete anyway?`,
    )
  }
  return confirmHandler({ nodeId, label: data.label, kind: data.kind })
}

export async function filterRemovalsWithGuard<T extends { id: string; data: StitchNodeData }>(
  toRemove: T[],
): Promise<string[]> {
  const allowed: string[] = []
  for (const node of toRemove) {
    if (node.data.kind === 'start' || node.data.kind === 'end') continue
    const ok = await confirmNodeDeletion(node.id, node.data)
    if (ok) allowed.push(node.id)
  }
  return allowed
}
