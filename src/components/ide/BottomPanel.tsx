import { useIdeStore } from '../../store/ideStore'
import { TerminalPanel } from './TerminalPanel'
import { ProblemsPanel } from './ProblemsPanel'
import { OutputPanel } from './OutputPanel'
import { DebugConsolePanel } from './DebugConsolePanel'

export function BottomPanel() {
  const bottomPanel = useIdeStore((s) => s.bottomPanel)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)
  const bottomPanelHeight = useIdeStore((s) => s.bottomPanelHeight)

  if (!bottomPanel) return null

  const tabs = [
    { id: 'terminal' as const, label: 'Terminal' },
    { id: 'problems' as const, label: 'Problems' },
    { id: 'output' as const, label: 'Output' },
    { id: 'debug' as const, label: 'Debug Console' },
  ]

  return (
    <div className="ide-bottom-panel" style={{ height: bottomPanelHeight }} data-testid="bottom-panel">
      <div className="bottom-panel-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`bottom-tab ${bottomPanel === t.id ? 'active' : ''}`}
            onClick={() => setBottomPanel(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="bottom-close" onClick={() => setBottomPanel(null)}>
          ×
        </button>
      </div>
      <div className="bottom-panel-body">
        {bottomPanel === 'terminal' && <TerminalPanel />}
        {bottomPanel === 'problems' && <ProblemsPanel />}
        {bottomPanel === 'output' && <OutputPanel />}
        {bottomPanel === 'debug' && <DebugConsolePanel />}
      </div>
    </div>
  )
}
