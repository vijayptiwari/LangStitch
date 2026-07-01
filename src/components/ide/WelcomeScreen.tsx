import { useIdeStore } from '../../store/ideStore'
import { useGraphStore } from '../../store/graphStore'
import { workspaceDisplayName } from '../../lib/workspace'

export function WelcomeScreen() {
  const setWelcomeVisible = useIdeStore((s) => s.setWelcomeVisible)
  const setViewMode = useIdeStore((s) => s.setViewMode)
  const recentProjects = useIdeStore((s) => s.recentProjects)
  const resetProject = useGraphStore((s) => s.resetProject)

  const openRecent = async (path: string) => {
    const res = await window.langtailor?.openPath?.(path)
    if (res?.ok) setWelcomeVisible(false)
  }

  return (
    <div className="welcome-screen" data-testid="welcome-screen">
      <h1>LangTailor</h1>
      <p className="welcome-tagline">Visual LangGraph IDE — design on canvas or edit code directly.</p>
      <div className="welcome-actions">
        <button
          type="button"
          className="welcome-btn primary"
          data-testid="welcome-new-graph"
          onClick={() => {
            resetProject()
            setWelcomeVisible(false)
            setViewMode('canvas')
          }}
        >
          New Graph
        </button>
        <button
          type="button"
          className="welcome-btn"
          onClick={() => {
            setWelcomeVisible(false)
            void window.langtailor?.commands?.openProject()
          }}
        >
          Open Project
        </button>
      </div>
      {recentProjects.length > 0 && (
        <div className="welcome-recent">
          <h2>Recent Projects</h2>
          <ul>
            {recentProjects.slice(0, 10).map((p) => (
              <li key={p}>
                <button
                  type="button"
                  className="welcome-recent-item"
                  data-testid="welcome-recent-item"
                  title={p}
                  onClick={() => void openRecent(p)}
                >
                  <span className="welcome-recent-name">{workspaceDisplayName(p)}</span>
                  <span className="welcome-recent-path">{p}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ToastContainer() {
  const toasts = useIdeStore((s) => s.toasts)
  const dismissToast = useIdeStore((s) => s.dismissToast)

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span>{t.message}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
