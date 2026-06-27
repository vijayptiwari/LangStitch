import type { CanvasViewport } from '../types/graph'

export function viewportStorageKey(projectName: string): string {
  return `langstitch-viewport-${projectName || 'My Workflow Graph'}`
}

/** Prefix for viewport keys persisted in localStorage (cycles 68, 164). */
export const VIEWPORT_STORAGE_PREFIX = 'langstitch-viewport-'

export function loadViewport(projectName: string): CanvasViewport | null {
  try {
    const raw = localStorage.getItem(viewportStorageKey(projectName))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CanvasViewport
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.zoom === 'number'
    ) {
      return parsed
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null
}

export function saveViewport(projectName: string, viewport: CanvasViewport): void {
  try {
    localStorage.setItem(viewportStorageKey(projectName), JSON.stringify(viewport))
  } catch {
    /* ignore quota errors */
  }
}
