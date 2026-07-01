import { useEffect, useMemo, useState } from 'react'
import { useIdeStore } from '../../store/ideStore'
import { runGraphMode } from '../../lib/runGraph'

const COMMANDS = [
  { id: 'view.canvas', label: 'View: Switch to Canvas', action: (s: ReturnType<typeof useIdeStore.getState>) => s.setViewMode('canvas') },
  { id: 'view.code', label: 'View: Switch to Code', action: (s: ReturnType<typeof useIdeStore.getState>) => s.setViewMode('code') },
  { id: 'panel.terminal', label: 'View: Toggle Terminal', action: (s: ReturnType<typeof useIdeStore.getState>) => s.setBottomPanel('terminal') },
  { id: 'panel.problems', label: 'View: Toggle Problems', action: (s: ReturnType<typeof useIdeStore.getState>) => s.setBottomPanel('problems') },
  { id: 'panel.explorer', label: 'View: Show Explorer', action: (s: ReturnType<typeof useIdeStore.getState>) => s.setActivePanel('explorer') },
  { id: 'project.export', label: 'Project: Export', action: (s: ReturnType<typeof useIdeStore.getState>) => s.openPlatform('export') },
  { id: 'project.build', label: 'Project: Build', action: () => { void runGraphMode('build') } },
  { id: 'project.run', label: 'Project: Run', action: () => { void runGraphMode('run') } },
  { id: 'project.debug', label: 'Project: Debug', action: () => { void runGraphMode('debug') } },
  { id: 'project.version', label: 'Project: Versions', action: (s: ReturnType<typeof useIdeStore.getState>) => s.openPlatform('versions') },
  { id: 'project.evaluator', label: 'Project: Open Evaluator', action: (s: ReturnType<typeof useIdeStore.getState>) => { s.setActivePanel('evaluator'); s.openPlatform('eval') } },
  { id: 'file.quickOpen', label: 'File: Quick Open', action: (s: ReturnType<typeof useIdeStore.getState>) => { s.setCommandPaletteOpen(false); s.setQuickOpenOpen(true) } },
]

export function CommandPalette() {
  const open = useIdeStore((s) => s.commandPaletteOpen)
  const setOpen = useIdeStore((s) => s.setCommandPaletteOpen)
  const [filter, setFilter] = useState('')

  const items = useMemo(() => {
    const q = filter.toLowerCase()
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
  }, [filter])

  useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  if (!open) return null

  return (
    <div className="ide-overlay" data-testid="command-palette" onClick={() => setOpen(false)}>
      <div className="ide-modal" onClick={(e) => e.stopPropagation()}>
        <input
          className="ide-input ide-modal-input"
          placeholder="Type a command..."
          value={filter}
          autoFocus
          onChange={(e) => setFilter(e.target.value)}
          data-testid="command-palette-input"
        />
        <ul className="command-list">
          {items.map((cmd) => (
            <li key={cmd.id}>
              <button
                type="button"
                className="command-item"
                onClick={() => {
                  cmd.action(useIdeStore.getState())
                  setOpen(false)
                }}
              >
                {cmd.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function QuickOpen() {
  const open = useIdeStore((s) => s.quickOpenOpen)
  const setOpen = useIdeStore((s) => s.setQuickOpenOpen)
  const virtualFiles = useIdeStore((s) => s.virtualFiles)
  const openFile = useIdeStore((s) => s.openFile)
  const setViewMode = useIdeStore((s) => s.setViewMode)
  const [filter, setFilter] = useState('')

  const paths = useMemo(() => {
    const q = filter.toLowerCase()
    return Object.keys(virtualFiles)
      .filter((p) => p.toLowerCase().includes(q))
      .slice(0, 20)
  }, [filter, virtualFiles])

  if (!open) return null

  return (
    <div className="ide-overlay" data-testid="quick-open" onClick={() => setOpen(false)}>
      <div className="ide-modal" onClick={(e) => e.stopPropagation()}>
        <input
          className="ide-input ide-modal-input"
          placeholder="Go to file..."
          value={filter}
          autoFocus
          onChange={(e) => setFilter(e.target.value)}
          data-testid="quick-open-input"
        />
        <ul className="command-list">
          {paths.map((path) => (
            <li key={path}>
              <button
                type="button"
                className="command-item"
                onClick={() => {
                  setViewMode('code')
                  openFile(path)
                  setOpen(false)
                }}
              >
                {path}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
