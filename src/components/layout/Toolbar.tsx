import { useRef } from 'react'
import {
  FolderOpen,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Server,
  Terminal,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { exportGraphDocument } from '../../lib/codegen/pythonGenerator'
import type { GraphDocument } from '../../types/graph'

function LangStitchLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12c3-4 6-4 8 0s5 4 8 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 16c3-4 6-4 8 0s5 4 8 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
      <circle cx="6" cy="8" r="2" fill="white" opacity="0.9" />
      <circle cx="18" cy="8" r="2" fill="white" opacity="0.9" />
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

  const saveProject = () => {
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
  }

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
    </header>
  )
}
