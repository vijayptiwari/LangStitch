import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FolderOpen,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Server,
  Terminal,
  HelpCircle,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { exportGraphDocument } from '../../lib/codegen/pythonGenerator'
import type { GraphDocument } from '../../types/graph'

function LangStitchLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="9" cy="16" r="3.25" fill="#a5b4fc" />
      <circle cx="23" cy="9" r="3.25" fill="#818cf8" />
      <circle cx="23" cy="23" r="3.25" fill="#6366f1" />
      <path
        d="M12.2 15.2 19.8 10.8 M12.2 16.8 19.8 21.2"
        stroke="#e0e7ff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9 16 H23"
        stroke="url(#lsGlow)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.35"
      />
      <defs>
        <linearGradient id="lsGlow" x1="9" y1="16" x2="23" y2="16">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Toolbar({ onOpenPlatform }: { onOpenPlatform: () => void }) {
  const graphDoc = useGraphStore((s) => s.document)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  const loadProject = useGraphStore((s) => s.loadProject)
  const resetProject = useGraphStore((s) => s.resetProject)
  const addSubgraph = useGraphStore((s) => s.addSubgraph)
  const navigateToGraph = useGraphStore((s) => s.navigateToGraph)
  const showCodePanel = useGraphStore((s) => s.showCodePanel)
  const toggleCodePanel = useGraphStore((s) => s.toggleCodePanel)
  const setDocumentMeta = useGraphStore((s) => s.setDocumentMeta)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const saveProject = useCallback(() => {
    const payload = getProjectPayload()
    const json = exportGraphDocument(
      payload.document,
      payload.nodes,
      payload.edges,
      payload.canvasByGraph,
      payload.navigationPath,
    )
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${graphDoc.name || 'graph'}.langstitch.json`
    a.click()
    URL.revokeObjectURL(url)
    setSavedAt(new Date().toLocaleTimeString())
  }, [getProjectPayload, graphDoc.name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveProject()
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveProject])

  const openProject = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as Record<string, unknown>
        if (raw.document) {
          loadProject(raw as Parameters<typeof loadProject>[0])
        } else {
          const { nodes, edges, canvasByGraph, navigationPath, ...docFields } = raw
          loadProject({
            document: docFields as unknown as GraphDocument,
            nodes: nodes as Parameters<typeof loadProject>[0]['nodes'],
            edges: edges as Parameters<typeof loadProject>[0]['edges'],
            canvasByGraph: canvasByGraph as Parameters<typeof loadProject>[0]['canvasByGraph'],
            navigationPath: navigationPath as string[] | undefined,
          })
        }
      } catch {
        alert('Invalid project file')
      }
    }
    reader.readAsText(file)
  }

  const handleNewSubgraph = () => {
    const name = prompt('Subgraph name', 'Worker Graph')
    if (name) addSubgraph(name)
  }

  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="toolbar-brand">
        <div className="logo">
          <LangStitchLogo />
        </div>
        <div>
          <div className="brand-title" data-testid="brand-title">LangStitch</div>
          <div className="brand-subtitle">Visual LangGraph IDE</div>
        </div>
      </div>

      <div className="toolbar-center">
        <input
          className="input graph-name-input"
          data-testid="graph-name-input"
          value={graphDoc.name}
          onChange={(e) => setDocumentMeta({ name: e.target.value })}
          aria-label="Graph name"
          placeholder="My workflow…"
        />
        <div className="subgraph-tabs">
          <Layers size={14} />
          {graphDoc.subgraphs.map((sg) => (
            <button
              key={sg.id}
              className={`subgraph-tab ${graphDoc.activeSubgraphId === sg.id ? 'active' : ''}`}
              onClick={() => navigateToGraph(sg.id)}
              type="button"
            >
              {sg.name}
            </button>
          ))}
          <button className="subgraph-tab add" onClick={handleNewSubgraph} type="button" title="New subgraph">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="toolbar-actions">
        <button className="btn-secondary" data-testid="toolbar-open" onClick={() => fileInputRef.current?.click()} type="button">
          <FolderOpen size={16} /> Open
        </button>
        <button className="btn-secondary" data-testid="toolbar-save" onClick={saveProject} type="button">
          <Save size={16} /> Save
          {savedAt && (
            <span className="toolbar-saved-at" data-testid="toolbar-saved-at">
              {savedAt}
            </span>
          )}
        </button>
        <button className="btn-secondary" onClick={resetProject} type="button">
          <RotateCcw size={16} /> Reset
        </button>
        <button className="btn-secondary" data-testid="toolbar-platform" onClick={onOpenPlatform} type="button">
          <Server size={16} /> Platform
        </button>
        <button
          className={`btn-secondary ${showCodePanel ? 'active' : ''}`}
          data-testid="toolbar-code"
          onClick={toggleCodePanel}
          type="button"
        >
          <Terminal size={16} /> Code
        </button>
        <button
          className="btn-secondary"
          data-testid="toolbar-shortcuts"
          onClick={() => setShowShortcuts(true)}
          type="button"
          title="Keyboard shortcuts"
        >
          <HelpCircle size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".langstitch.json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) openProject(file)
            e.target.value = ''
          }}
        />
      </div>
      {showShortcuts && (
        <div className="shortcuts-overlay" role="dialog" data-testid="shortcuts-modal" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Keyboard shortcuts</h3>
            <ul>
              <li><kbd>Ctrl</kbd>+<kbd>S</kbd> — Save project</li>
              <li><kbd>?</kbd> — Toggle this help</li>
            </ul>
            <button className="btn-secondary" type="button" onClick={() => setShowShortcuts(false)}>Close</button>
          </div>
        </div>
      )}
    </header>
  )
}
