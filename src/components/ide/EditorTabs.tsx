import { Code2, LayoutGrid, X } from 'lucide-react'
import { useIdeStore } from '../../store/ideStore'

/**
 * Unified editor tab strip: a pinned Canvas tab plus a tab per open code file.
 * Selecting the Canvas tab switches to canvas mode; selecting a file switches to
 * code mode and focuses that file. Breakpoints are mirrored as a red dot on the
 * owning file's tab.
 */
export function EditorTabs() {
  const viewMode = useIdeStore((s) => s.viewMode)
  const setViewMode = useIdeStore((s) => s.setViewMode)
  const openFilePaths = useIdeStore((s) => s.openFilePaths)
  const activeFilePath = useIdeStore((s) => s.activeFilePath)
  const setActiveFilePath = useIdeStore((s) => s.setActiveFilePath)
  const closeFile = useIdeStore((s) => s.closeFile)
  const breakpoints = useIdeStore((s) => s.breakpoints)

  const label = (path: string) => path.split('/').pop() ?? path
  const hasBp = (path: string) => (breakpoints[path]?.length ?? 0) > 0

  return (
    <div className="editor-tabs" role="tablist" aria-label="Editor tabs" data-testid="view-mode">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'canvas'}
        className={`editor-tab editor-tab--canvas ${viewMode === 'canvas' ? 'active' : ''}`}
        data-testid="toggle-canvas"
        onClick={() => setViewMode('canvas')}
      >
        <LayoutGrid size={14} />
        <span className="editor-tab-label">Canvas</span>
      </button>

      <span className="editor-tabs-sep" aria-hidden />

      {openFilePaths.length === 0 && (
        <span className="editor-tabs-hint">
          <Code2 size={13} /> Open a file from the Explorer
        </span>
      )}

      {openFilePaths.map((path) => {
        const isActive = viewMode === 'code' && path === activeFilePath
        return (
          <div
            key={path}
            role="tab"
            aria-selected={isActive}
            data-testid="toggle-code"
            className={`editor-tab editor-tab--file ${isActive ? 'active' : ''}`}
            title={path}
            onClick={() => {
              setActiveFilePath(path)
              setViewMode('code')
            }}
          >
            {hasBp(path) ? (
              <span className="editor-tab-bp" aria-hidden />
            ) : (
              <Code2 size={13} className="editor-tab-icon" />
            )}
            <span className="editor-tab-label">{label(path)}</span>
            <button
              type="button"
              className="editor-tab-close"
              aria-label={`Close ${label(path)}`}
              onClick={(e) => {
                e.stopPropagation()
                closeFile(path)
              }}
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
