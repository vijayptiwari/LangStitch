import { useIdeStore } from '../../store/ideStore'
import { useGraphStore } from '../../store/graphStore'

export function StatusBar() {
  const viewMode = useIdeStore((s) => s.viewMode)
  const diagnostics = useIdeStore((s) => s.diagnostics)
  const isDirty = useGraphStore((s) => s.isDirty)
  const document = useGraphStore((s) => s.document)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  return (
    <footer className="ide-status-bar" data-testid="status-bar">
      <span className="status-item">{document.name}</span>
      <span className="status-item">{viewMode === 'canvas' ? 'Canvas' : 'Code'}</span>
      {isDirty && <span className="status-item status-dirty">Modified</span>}
      <span className="status-spacer" />
      <button
        type="button"
        className="status-item status-btn"
        onClick={() => setBottomPanel('problems')}
      >
        {errors > 0 && <span className="status-error">{errors} errors</span>}
        {warnings > 0 && <span className="status-warn">{warnings} warnings</span>}
        {errors === 0 && warnings === 0 && 'No problems'}
      </button>
      <button
        type="button"
        className="status-item status-btn"
        onClick={() => setBottomPanel('terminal')}
      >
        Terminal
      </button>
    </footer>
  )
}
