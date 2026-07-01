import { useIdeStore } from '../store/ideStore'
import { useGraphStore } from '../store/graphStore'

export interface IdeTestApi {
  updateVirtualFile: (path: string, content: string) => void
  getVirtualFiles: () => Record<string, string>
  getNodeIds: () => string[]
  selectNode: (nodeId: string) => void
}

declare global {
  interface Window {
    __langtailorIdeTest?: IdeTestApi
  }
}

/** Dev/E2E hooks for IDE sync tests (not used in production builds). */
export function registerIdeTestHooks(): void {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV && import.meta.env.VITE_APP_MODE !== 'ide') return

  window.__langtailorIdeTest = {
    updateVirtualFile: (path, content) => useIdeStore.getState().updateVirtualFile(path, content),
    getVirtualFiles: () => useIdeStore.getState().virtualFiles,
    getNodeIds: () => useGraphStore.getState().nodes.map((n) => n.id),
    selectNode: (nodeId) => useGraphStore.getState().selectNode(nodeId),
  }
}
