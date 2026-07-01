import {
  Files,
  Search,
  Play,
  FlaskConical,
  Store,
} from 'lucide-react'
import { useIdeStore, type IdePanel } from '../../store/ideStore'

const items: { id: IdePanel; icon: typeof Files; label: string }[] = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'run', icon: Play, label: 'Run and Debug' },
  { id: 'evaluator', icon: FlaskConical, label: 'Evaluator' },
  { id: 'extensions', icon: Store, label: 'Marketplace' },
]

export function ActivityBar() {
  const activePanel = useIdeStore((s) => s.activePanel)
  const setActivePanel = useIdeStore((s) => s.setActivePanel)

  return (
    <nav className="activity-bar" data-testid="activity-bar" aria-label="Activity bar">
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          className={`activity-btn ${activePanel === id ? 'active' : ''}`}
          title={label}
          aria-label={label}
          onClick={() => setActivePanel(activePanel === id ? null : id)}
        >
          <Icon size={22} />
        </button>
      ))}
      <div className="activity-spacer" />
    </nav>
  )
}
