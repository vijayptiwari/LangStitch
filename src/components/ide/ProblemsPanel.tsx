import { useIdeStore } from '../../store/ideStore'

export function ProblemsPanel() {
  const diagnostics = useIdeStore((s) => s.diagnostics)

  return (
    <div className="problems-panel" data-testid="problems-panel">
      {diagnostics.length === 0 && (
        <p className="problems-empty">No problems detected.</p>
      )}
      <ul className="problems-list">
        {diagnostics.map((d, i) => (
          <li key={i} className={`problem-item severity-${d.severity}`}>
            <span className="problem-severity">{d.severity}</span>
            {d.file && <span className="problem-file">{d.file}</span>}
            <span className="problem-message">{d.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
