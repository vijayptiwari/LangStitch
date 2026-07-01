import { useMemo, useState, useEffect } from 'react'
import {
  BookText,
  Boxes,
  Braces,
  Brain,
  ChevronDown,
  ChevronRight,
  Container,
  FileCode2,
  FileText,
  FileJson,
  FlaskConical,
  Folder,
  FolderOpen,
  IdCard,
  Package,
  Plug,
  Settings2,
  Workflow,
  Wrench,
} from 'lucide-react'
import { useIdeStore } from '../../store/ideStore'
import { useGraphStore } from '../../store/graphStore'
import { runGraphMode, stopGraphRun } from '../../lib/runGraph'
import { MarketplacePanel } from '../marketplace/MarketplacePanel'

interface TreeNode {
  name: string
  path: string
  children: Map<string, TreeNode>
  isFile: boolean
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map(), isFile: false }
  for (const full of paths) {
    const parts = full.split('/').filter(Boolean)
    let cur = root
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1
      let child = cur.children.get(part)
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
          isFile,
        }
        cur.children.set(part, child)
      }
      cur = child
    })
  }
  return root
}

function FileIcon({ name, path }: { name: string; path: string }) {
  const lower = name.toLowerCase()
  const p = path.toLowerCase()

  // Scaffold-aware icons keyed on path/name so the project structure reads at a
  // glance (persona = ID card, nodes = brain, tools = wrench, …).
  if (p.includes('persona')) return <IdCard size={14} className="explorer-icon persona" />
  if (lower === 'pyproject.toml' || lower === 'setup.py' || lower === 'requirements.txt')
    return <Package size={14} className="explorer-icon pkg" />
  if (lower.startsWith('readme')) return <BookText size={14} className="explorer-icon doc" />
  if (lower === 'dockerfile' || lower.includes('docker-compose'))
    return <Container size={14} className="explorer-icon docker" />
  if (p.includes('/tests/') || lower.startsWith('test_') || lower.endsWith('_test.py'))
    return <FlaskConical size={14} className="explorer-icon test" />
  if (p.includes('/tools/') || lower.includes('tool'))
    return <Wrench size={14} className="explorer-icon tool" />
  if (p.includes('/connections/') || lower.includes('connector') || lower.includes('mcp'))
    return <Plug size={14} className="explorer-icon connector" />
  if (lower.includes('graph') || lower === '__main__.py')
    return <Workflow size={14} className="explorer-icon graph" />
  if (p.includes('/nodes/') || lower.includes('agent') || lower.includes('llm'))
    return <Brain size={14} className="explorer-icon node" />
  if (lower === 'config.py' || lower.includes('settings'))
    return <Settings2 size={14} className="explorer-icon config" />
  if (lower.includes('state') || lower.includes('schema'))
    return <Boxes size={14} className="explorer-icon state" />
  if (name.endsWith('.json')) return <FileJson size={14} className="explorer-icon json" />
  if (name.endsWith('.toml') || name.endsWith('.yaml') || name.endsWith('.yml'))
    return <Braces size={14} className="explorer-icon cfg" />
  if (name.endsWith('.py')) return <FileCode2 size={14} className="explorer-icon py" />
  return <FileText size={14} className="explorer-icon" />
}

function TreeView({
  node,
  depth,
  expanded,
  toggle,
  onOpen,
  activeFile,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  toggle: (p: string) => void
  onOpen: (p: string) => void
  activeFile: string | null
}) {
  const entries = [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  return (
    <>
      {entries.map((child) =>
        child.isFile ? (
          <button
            key={child.path}
            type="button"
            className={`explorer-row explorer-file${activeFile === child.path ? ' active' : ''}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => onOpen(child.path)}
            title={child.path}
          >
            <FileIcon name={child.name} path={child.path} />
            <span className="explorer-row-label">{child.name}</span>
          </button>
        ) : (
          <div key={child.path}>
            <button
              type="button"
              className="explorer-row explorer-dir-row"
              style={{ paddingLeft: 4 + depth * 14 }}
              onClick={() => toggle(child.path)}
            >
              {expanded.has(child.path) ? (
                <ChevronDown size={14} className="explorer-chevron" />
              ) : (
                <ChevronRight size={14} className="explorer-chevron" />
              )}
              {expanded.has(child.path) ? (
                <FolderOpen size={14} className="explorer-icon folder" />
              ) : (
                <Folder size={14} className="explorer-icon folder" />
              )}
              <span className="explorer-row-label">{child.name}</span>
            </button>
            {expanded.has(child.path) && (
              <TreeView
                node={child}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                onOpen={onOpen}
                activeFile={activeFile}
              />
            )}
          </div>
        ),
      )}
    </>
  )
}

export function ExplorerPanel() {
  const virtualFiles = useIdeStore((s) => s.virtualFiles)
  const openFile = useIdeStore((s) => s.openFile)
  const activeFile = useIdeStore((s) => s.activeFilePath)
  const setViewMode = useIdeStore((s) => s.setViewMode)
  const projectName = useGraphStore((s) => s.document.name)

  const paths = useMemo(() => Object.keys(virtualFiles).sort(), [virtualFiles])
  const root = useMemo(() => buildTree(paths), [paths])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsedRoot, setCollapsedRoot] = useState(false)

  // Auto-expand all folders the first time files appear.
  useEffect(() => {
    if (paths.length === 0) return
    setExpanded((prev) => {
      if (prev.size > 0) return prev
      const next = new Set<string>()
      for (const p of paths) {
        const parts = p.split('/').filter(Boolean)
        for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'))
      }
      return next
    })
  }, [paths])

  const toggle = (p: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })

  const onOpen = (p: string) => {
    setViewMode('code')
    openFile(p)
  }

  return (
    <div className="side-panel-content" data-testid="explorer-panel">
      <h3 className="side-panel-title">Explorer</h3>
      {paths.length === 0 ? (
        <p className="side-panel-empty">Create or open a graph to see generated files.</p>
      ) : (
        <div className="explorer-tree">
          <button
            type="button"
            className="explorer-row explorer-root-row"
            onClick={() => setCollapsedRoot((v) => !v)}
            title={projectName}
          >
            {collapsedRoot ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="explorer-root-name">{projectName || 'project'}</span>
          </button>
          {!collapsedRoot && (
            <TreeView
              node={root}
              depth={1}
              expanded={expanded}
              toggle={toggle}
              onOpen={onOpen}
              activeFile={activeFile}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function SearchPanel() {
  const [query, setQuery] = useState('')
  const virtualFiles = useIdeStore((s) => s.virtualFiles)
  const openFile = useIdeStore((s) => s.openFile)
  const setViewMode = useIdeStore((s) => s.setViewMode)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const hits: Array<{ path: string; line: number; text: string }> = []
    for (const [path, content] of Object.entries(virtualFiles)) {
      content.split('\n').forEach((line, i) => {
        if (line.toLowerCase().includes(q)) {
          hits.push({ path, line: i + 1, text: line.trim() })
        }
      })
    }
    return hits.slice(0, 50)
  }, [query, virtualFiles])

  return (
    <div className="side-panel-content" data-testid="search-panel">
      <h3 className="side-panel-title">Search</h3>
      <input
        className="ide-input"
        placeholder="Search in files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="search-input"
      />
      <div className="search-results">
        {results.map((r) => (
          <button
            key={`${r.path}:${r.line}`}
            type="button"
            className="search-result"
            onClick={() => {
              setViewMode('code')
              openFile(r.path)
            }}
          >
            <span className="search-result-path">{r.path}:{r.line}</span>
            <span className="search-result-text">{r.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function RunPanel() {
  const runningServer = useIdeStore((s) => s.runningServer)
  return (
    <div className="side-panel-content" data-testid="run-panel">
      <h3 className="side-panel-title">Run and Build</h3>
      <button
        type="button"
        className="ide-btn ide-btn-primary"
        data-testid="build-project"
        onClick={() => void runGraphMode('build')}
      >
        Build Project
      </button>
      <p className="side-panel-hint">
        Build creates a <code>.venv</code> and installs the project into it.
      </p>
      {runningServer ? (
        <button
          type="button"
          className="ide-btn ide-btn-danger"
          data-testid="stop-graph"
          onClick={() => void stopGraphRun()}
        >
          Stop Server
        </button>
      ) : (
        <button
          type="button"
          className="ide-btn"
          data-testid="run-graph"
          onClick={() => void runGraphMode('run')}
        >
          Run Server
        </button>
      )}
      <button
        type="button"
        className="ide-btn"
        data-testid="debug-graph"
        onClick={() => void runGraphMode('debug')}
      >
        Debug Graph
      </button>
      <button
        type="button"
        className="ide-btn"
        data-testid="run-tests"
        onClick={() => void runGraphMode('test')}
      >
        Run Tests
      </button>
    </div>
  )
}

export function EvaluatorPanel() {
  const openPlatform = useIdeStore((s) => s.openPlatform)
  const evalConfig = useGraphStore((s) => s.document.settings?.eval)

  return (
    <div className="side-panel-content" data-testid="evaluator-panel">
      <h3 className="side-panel-title">Evaluator</h3>
      <p className="side-panel-hint">
        Run datasets against your graph, score outputs, and track regressions.
      </p>
      <button
        type="button"
        className="ide-btn ide-btn-primary"
        data-testid="open-evaluator"
        onClick={() => openPlatform('eval')}
      >
        <FlaskConical size={14} /> Open Evaluator
      </button>
      {evalConfig?.datasetName && (
        <div className="evaluator-summary">
          <div className="side-panel-subtitle">Active dataset</div>
          <button
            type="button"
            className="evaluator-dataset"
            onClick={() => openPlatform('eval')}
          >
            <FlaskConical size={13} />
            <span>{evalConfig.datasetName}</span>
            <span className={`evaluator-dataset-state ${evalConfig.enabled ? 'on' : ''}`}>
              {evalConfig.enabled ? 'enabled' : 'off'}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export function ExtensionsPanel() {
  return (
    <div className="side-panel-content side-panel-content-flush" data-testid="extensions-panel">
      <MarketplacePanel />
    </div>
  )
}

export function SidePanel() {
  const activePanel = useIdeStore((s) => s.activePanel)
  if (!activePanel) return null

  return (
    <aside className="ide-side-panel" data-testid="ide-side-panel">
      {activePanel === 'explorer' && <ExplorerPanel />}
      {activePanel === 'search' && <SearchPanel />}
      {activePanel === 'run' && <RunPanel />}
      {activePanel === 'evaluator' && <EvaluatorPanel />}
      {activePanel === 'extensions' && <ExtensionsPanel />}
    </aside>
  )
}
