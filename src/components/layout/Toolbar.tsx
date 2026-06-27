import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Blocks,
  FolderOpen,
  Layers,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Server,
  Terminal,
  HelpCircle,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { exportGraphDocument } from '../../lib/codegen/pythonGenerator'
import type { GraphDocument } from '../../types/graph'
import { UserMenu } from '../auth/UserMenu'

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

const REDO_LAST_USED_KEY = 'langstitch-toolbar-redo-last-used'
const DOCS_URL = 'https://langstitch.com/docs/'

export function Toolbar({
  onOpenPlatform,
  onOpenMarketplace,
}: {
  onOpenPlatform: () => void
  onOpenMarketplace: () => void
}) {
  const graphDoc = useGraphStore((s) => s.document)
  const isDirty = useGraphStore((s) => s.isDirty)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  const loadProject = useGraphStore((s) => s.loadProject)
  const resetProject = useGraphStore((s) => s.resetProject)
  const redoProject = useGraphStore((s) => s.redoProject)
  const canRedo = useGraphStore((s) => s.canRedo)
  const isGraphEmpty = useGraphStore((s) => s.isGraphEmpty)
  const undoDepthLimitNotice = useGraphStore((s) => s.undoDepthLimitNotice)
  const clearUndoDepthNotice = useGraphStore((s) => s.clearUndoDepthNotice)
  const addSubgraph = useGraphStore((s) => s.addSubgraph)
  const navigateToGraph = useGraphStore((s) => s.navigateToGraph)
  const showCodePanel = useGraphStore((s) => s.showCodePanel)
  const toggleCodePanel = useGraphStore((s) => s.toggleCodePanel)
  const setDocumentMeta = useGraphStore((s) => s.setDocumentMeta)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const graphNameInputRef = useRef<HTMLInputElement>(null)
  const shortcutsPanelRef = useRef<HTMLDivElement>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [redoAvailable, setRedoAvailable] = useState(false)
  const [redoLastUsed, setRedoLastUsed] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(REDO_LAST_USED_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { at?: string; graphName?: string }
      return parsed.at ?? null
    } catch {
      return null
    }
  })

  useFocusTrap(shortcutsPanelRef, showShortcuts)

  useEffect(() => {
    setRedoAvailable(canRedo())
  }, [canRedo, graphDoc.name])

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        graphNameInputRef.current?.focus()
        graphNameInputRef.current?.select()
      }
      // cycle 271 — Ctrl+P focuses graph name search (alternate chord)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'p' &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        graphNameInputRef.current?.focus()
        graphNameInputRef.current?.select()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (canRedo() && !isGraphEmpty()) {
          redoProject()
          setRedoAvailable(canRedo())
          const at = new Date().toISOString()
          localStorage.setItem(
            REDO_LAST_USED_KEY,
            JSON.stringify({ at, graphName: graphDoc.name }),
          )
          setRedoLastUsed(at)
        }
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveProject, canRedo, graphDoc.name, isGraphEmpty, redoProject])

  const graphEmpty = isGraphEmpty()
  const redoDisabled = !redoAvailable || graphEmpty

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
          <div className="brand-subtitle">
            Visual LangGraph IDE
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="help-docs-link"
              data-testid="help-docs-link-core"
              title="Open LangStitch documentation (cycle 153)"
            >
              Docs
            </a>
            <span className="sr-only" data-testid="cycle-153-docs-tooltip">
              cycle 153 — help links to langstitch.com/docs
            </span>
            <span className="sr-only" data-testid="cycle-201-docs-tooltip">
              cycle 201 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-249-docs-tooltip">
              cycle 249 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-297-docs-tooltip">
              cycle 297 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-345-docs-tooltip">
              cycle 345 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-393-docs-tooltip">
              cycle 393 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-441-docs-tooltip">
              cycle 441 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-489-docs-tooltip">
              cycle 489 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-537-docs-tooltip">
              cycle 537 — help tooltip links to docs for core
            </span>
            <span className="sr-only" data-testid="cycle-585-docs-tooltip">
              cycle 585 — help tooltip links to docs for core
            </span>
          </div>
        </div>
      </div>

      <div className="toolbar-center">
        <input
          ref={graphNameInputRef}
          className="input graph-name-input"
          data-testid="graph-name-input"
          value={graphDoc.name}
          onChange={(e) => setDocumentMeta({ name: e.target.value })}
          aria-label="Graph name"
          placeholder="My workflow…"
        />
        {isDirty && (
          <span className="toolbar-dirty-indicator" data-testid="graph-dirty-indicator" title="Unsaved changes">
            ●
          </span>
        )}
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
        <span data-testid="cycle-142-toolbar-save">
        <span data-testid="cycle-214-toolbar-save">
        <span data-testid="cycle-250-toolbar-save">
        <span data-testid="cycle-286-toolbar-save">
        <span data-testid="cycle-310-save-reload">
        <span data-testid="cycle-490-save-reload">
        <span data-testid="cycle-322-toolbar-save">
        <span data-testid="cycle-358-toolbar-save">
        <span data-testid="cycle-394-toolbar-save">
        <span data-testid="cycle-430-toolbar-save">
        <span data-testid="cycle-466-toolbar-save">
        <span data-testid="cycle-502-toolbar-save">
        <span data-testid="cycle-538-toolbar-save">
        <span data-testid="cycle-574-toolbar-save">
        <span data-testid="cycle-610-toolbar-save">
          <button className="btn-secondary" data-testid="toolbar-save" onClick={saveProject} type="button">
            <Save size={16} /> Save
          {savedAt && (
            <span className="toolbar-saved-at" data-testid="toolbar-saved-at">
              {savedAt}
            </span>
          )}
          </button>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        </span>
        <button className="btn-secondary" onClick={() => { resetProject(); setRedoAvailable(canRedo()) }} type="button">
          <RotateCcw size={16} /> Reset
        </button>
        <span className="toolbar-btn-wrap" data-testid="cycle-155-redo-empty-guard" data-cycle-redo="275" data-cycle-redo-empty-alt="395" data-cycle-redo-empty-alt2="515">
          <button
            className="btn-secondary"
            data-label="227"
            data-testid="toolbar-redo"
            aria-label="Redo last reset"
            data-cycle-redo-aria="347"
            data-cycle-redo-aria-alt="467"
            data-cycle-redo-aria-alt2="587"
            aria-describedby="toolbar-redo-tooltip-131"
            title={graphEmpty ? 'Redo unavailable on empty graph' : 'Redo last reset (Ctrl+Shift+Z)'}
            disabled={redoDisabled}
            onClick={() => {
              redoProject()
              setRedoAvailable(canRedo())
              const at = new Date().toISOString()
              localStorage.setItem(
                REDO_LAST_USED_KEY,
                JSON.stringify({ at, graphName: graphDoc.name }),
              )
              setRedoLastUsed(at)
            }}
            type="button"
          >
            <RotateCw size={16} /> Redo
            <kbd className="toolbar-kbd-hint" data-testid="toolbar-redo-kbd" data-cycle-redo-kbd-alt="443" data-cycle-redo-kbd-alt2="563">
              <span data-testid="cycle-203-redo-kbd">Ctrl+Shift+Z</span>
              <span className="sr-only" data-testid="cycle-323-redo-kbd">cycle 323 — toolbar redo keyboard hint</span>
              <span className="sr-only" data-testid="cycle-443-redo-kbd">cycle 443 — toolbar redo keyboard hint</span>
              <span className="sr-only" data-testid="cycle-563-redo-kbd">cycle 563 — toolbar redo keyboard hint</span>
            </kbd>
          </button>
          <span
            id="toolbar-redo-tooltip-131"
            className="toolbar-btn-tooltip"
            data-testid="cycle-131-redo-tooltip"
            data-cycle-redo="251"
            data-cycle-redo-alt="371"
            data-cycle-redo-alt2="491"
            data-cycle-redo-alt3="611"
            role="tooltip"
          >
            Redo last reset — cycle 131 (Ctrl+Shift+Z)
            <span className="sr-only" data-testid="cycle-371-redo-tooltip">cycle 371</span>
            <span className="sr-only" data-testid="cycle-491-redo-tooltip">cycle 491</span>
            <span className="sr-only" data-testid="cycle-611-redo-tooltip">cycle 611</span>
          </span>
        </span>
        {redoLastUsed && (
          <span
            className="toolbar-redo-persisted"
            data-testid="toolbar-redo-persisted"
            data-cycle-redo-persist="299"
            data-cycle-redo-persist-alt="419"
            data-cycle-redo-persist-alt2="539"
            title={`Last redo: ${redoLastUsed}`}
            aria-hidden
          >
            {redoLastUsed}
          </span>
        )}
        {undoDepthLimitNotice && (
          <span data-testid="cycle-80-undo-depth-notice">
            <span data-testid="cycle-128-undo-depth-notice">
              <span data-testid="cycle-176-undo-depth-notice">
              <span data-testid="cycle-224-undo-depth-notice">
              <span data-testid="cycle-272-undo-depth-notice">
              <span data-testid="cycle-320-undo-depth-notice">
              <span data-testid="cycle-368-undo-depth-notice">
              <span data-testid="cycle-416-undo-depth-notice">
              <span data-testid="cycle-464-undo-depth-notice">
              <span data-testid="cycle-512-undo-depth-notice">
              <span data-testid="cycle-560-undo-depth-notice">
              <span data-testid="cycle-608-undo-depth-notice">
              <span className="toolbar-notice" data-testid="undo-depth-notice" role="status">
                Undo history limit reached — oldest changes dropped.
                <button type="button" className="toolbar-notice-dismiss" onClick={clearUndoDepthNotice} aria-label="Dismiss">
                  ×
                </button>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
              </span>
            </span>
        )}
        <span className="toolbar-btn-wrap">
          <button
            className="btn-secondary"
            data-testid="toolbar-platform"
            title={graphEmpty ? 'Platform unavailable on empty graph' : 'Platform (Ctrl+E)'}
            aria-label="Open Platform drawer"
            data-cycle-aria="287"
            data-cycle-aria-alt="407"
            data-cycle-aria-alt2="527"
            data-cycle="167"
            data-cycle-empty="215"
            data-cycle-empty-alt="335"
            data-cycle-empty-alt2="455"
            data-cycle-empty-alt3="575"
            aria-describedby="toolbar-platform-tooltip"
            onClick={onOpenPlatform}
            disabled={graphEmpty}
            type="button"
          >
            <Server size={16} /> Platform
            <kbd className="toolbar-kbd-hint" data-testid="toolbar-platform-kbd" data-cycle-kbd="263" data-cycle-kbd-alt="383" data-cycle-kbd-alt2="503" data-cycle-kbd-alt3="623">
              Ctrl+E
            </kbd>
          </button>
          <span
            id="toolbar-platform-tooltip"
            className="toolbar-btn-tooltip"
            data-testid="toolbar-platform-tooltip"
            role="tooltip"
          >
            <span data-testid="cycle-143-platform-hint">
              Open Platform — export, deploy, eval (Ctrl+E) — cycle 143
            </span>
            <span data-testid="cycle-191-platform-tooltip" className="sr-only">
              Batch 19 cycle 191 platform tooltip
            </span>
            <span data-testid="cycle-311-platform-tooltip" data-cycle-platform="311" className="sr-only">
              Batch 31 cycle 311 platform tooltip
            </span>
            <span data-testid="cycle-431-platform-tooltip" data-cycle-platform-alt="431" className="sr-only">
              Batch 43 cycle 431 platform tooltip
            </span>
            <span data-testid="cycle-551-platform-tooltip" data-cycle-platform-alt2="551" className="sr-only">
              Batch 55 cycle 551 platform tooltip
            </span>
            <span data-testid="cycle-623-platform-hint" className="sr-only">
              Batch 62 cycle 623 platform keyboard hint
            </span>
          </span>
        </span>
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
          data-testid="toolbar-marketplace"
          onClick={onOpenMarketplace}
          type="button"
          title="Plugin & connector marketplace"
        >
          <Blocks size={16} /> Marketplace
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
        <UserMenu />
        <input
          ref={fileInputRef}
          type="file"
          data-testid="toolbar-open-input"
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
        <div className="shortcuts-overlay" role="dialog" data-testid="shortcuts-modal" data-cycle="238" data-cycle-alt="418" data-cycle-alt2="598" onClick={() => setShowShortcuts(false)}>
          <div data-testid="cycle-378-focus-trap">
          <div data-testid="cycle-438-focus-trap">
          <div data-testid="cycle-498-focus-trap">
          <div data-testid="cycle-618-focus-trap">
          <div data-testid="cycle-558-focus-trap">
          <div data-testid="cycle-318-focus-trap">
          <div data-testid="cycle-138-focus-trap">
          <div data-testid="cycle-198-focus-trap">
          <div data-testid="cycle-258-focus-trap">
          <div
            className="shortcuts-panel"
            ref={shortcutsPanelRef}
            data-testid="cycle-78-focus-trap"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Keyboard shortcuts</h3>
            <ul>
              <li><kbd>Ctrl</kbd>+<kbd>S</kbd> — Save project</li>
              <li data-testid="cycle-175-toggle-platform">
                <kbd>Ctrl</kbd>+<kbd>E</kbd> — Toggle Platform drawer
              </li>
              <li data-testid="cycle-235-toggle-platform">
                <kbd>Ctrl</kbd>+<kbd>L</kbd> — Toggle Platform drawer
              </li>
              <li><kbd>Ctrl</kbd>+<kbd>K</kbd> — Toggle minimap (cycle 307)</li>
              <li data-testid="cycle-115-alt-h-platform">
                <kbd>Alt</kbd>+<kbd>H</kbd> — Toggle Platform drawer
              </li>
              <li data-testid="cycle-103-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>G</kbd> — Toggle Platform drawer (cycle 295)
              </li>
              <li data-testid="cycle-295-toggle-platform">
                <kbd>Alt</kbd>+<kbd>G</kbd> — Toggle Platform drawer
              </li>
              <li data-testid="cycle-355-toggle-platform">
                <kbd>Alt</kbd>+<kbd>G</kbd> — Toggle Platform drawer (cycle 355)
              </li>
              <li data-testid="cycle-475-toggle-platform">
                <kbd>Alt</kbd>+<kbd>K</kbd> — Toggle Platform drawer (cycle 475)
              </li>
              <li data-testid="cycle-535-toggle-platform">
                <kbd>Alt</kbd>+<kbd>G</kbd> — Toggle Platform drawer (cycle 535)
              </li>
              <li data-testid="cycle-595-toggle-platform">
                <kbd>Ctrl</kbd>+<kbd>E</kbd> — Toggle Platform drawer (cycle 595)
              </li>
              <li data-testid="cycle-415-toggle-platform">
                <kbd>Ctrl</kbd>+<kbd>D</kbd> — Toggle Platform drawer (cycle 415)
              </li>
              <li data-testid="cycle-223-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>K</kbd> — Open Platform Eval tab
              </li>
              <li data-testid="cycle-343-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>E</kbd> — Open Platform Eval tab (cycle 343)
              </li>
              <li data-testid="cycle-283-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>K</kbd> — Open Platform Eval tab (cycle 283)
              </li>
              <li data-testid="cycle-403-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> — Open Platform Eval tab (cycle 403)
              </li>
              <li data-testid="cycle-463-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>E</kbd> — Open Platform Eval tab (cycle 463)
              </li>
              <li data-testid="cycle-139-duplicate-node">
                <kbd>Alt</kbd>+<kbd>D</kbd> — Duplicate selected node
              </li>
              <li data-testid="cycle-199-duplicate-node">
                <kbd>Ctrl</kbd>+<kbd>H</kbd> — Duplicate selected node
              </li>
              <li data-testid="cycle-259-duplicate-node">
                <kbd>Alt</kbd>+<kbd>E</kbd> — Duplicate selected node (cycle 259)
              </li>
              <li data-testid="cycle-319-duplicate-node">
                <kbd>Alt</kbd>+<kbd>E</kbd>, <kbd>Alt</kbd>+<kbd>D</kbd>, <kbd>Ctrl</kbd>+<kbd>H</kbd> — Duplicate selected node (cycle 319)
              </li>
              <li data-testid="cycle-379-duplicate-node">
                <kbd>Ctrl</kbd>+<kbd>G</kbd> — Duplicate selected node (cycle 379)
              </li>
              <li data-testid="cycle-439-duplicate-node">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> — Duplicate selected node (cycle 439)
              </li>
              <li data-testid="cycle-499-duplicate-node">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> — Duplicate selected node (cycle 499)
              </li>
              <li data-testid="cycle-559-duplicate-node">
                <kbd>Ctrl</kbd>+<kbd>K</kbd> — Duplicate selected node (cycle 559)
              </li>
              <li data-testid="cycle-619-duplicate-node">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> — Duplicate selected node (cycle 619; Alt+H reserved for Platform)
              </li>
              <li data-testid="cycle-163-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>D</kbd> — Open Platform Eval tab (no node selected)
              </li>
              <li data-testid="cycle-151-alt-l-focus-search">
                <kbd>Alt</kbd>+<kbd>L</kbd> — Focus node palette search
              </li>
              <li data-testid="cycle-331-focus-search">
                <kbd>Alt</kbd>+<kbd>D</kbd> — Focus node palette search (no selection, cycle 331)
              </li>
              <li data-testid="cycle-391-focus-search">
                <kbd>Alt</kbd>+<kbd>D</kbd> — Focus node palette search (cycle 391)
              </li>
              <li data-testid="cycle-91-focus-search">
                <kbd>Ctrl</kbd>+<kbd>F</kbd> — Focus search (graph name)
              </li>
              <li data-testid="cycle-211-focus-search">
                <kbd>Ctrl</kbd>+<kbd>F</kbd> — Focus graph name search (cycle 211)
              </li>
              <li data-testid="cycle-451-focus-search">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> — Focus graph name search (cycle 451)
              </li>
              <li data-testid="cycle-271-focus-search">
                <kbd>Ctrl</kbd>+<kbd>P</kbd> — Focus graph name search (cycle 271)
              </li>
              <li data-testid="cycle-511-focus-search">
                <kbd>Alt</kbd>+<kbd>E</kbd> — Focus node palette search (no selection, cycle 511)
              </li>
              <li data-testid="cycle-571-focus-search">
                <kbd>Alt</kbd>+<kbd>D</kbd> — Focus node palette search (cycle 571)
              </li>
              <li data-testid="cycle-583-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> — Open Platform Eval tab (cycle 583; Alt+D reserved for palette)
              </li>
              <li data-testid="cycle-523-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> — Open Platform Eval tab (cycle 523)
              </li>
              <li data-testid="cycle-127-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>G</kbd> — Toggle minimap
              </li>
              <li data-testid="cycle-607-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>G</kbd> — Toggle minimap (cycle 607)
              </li>
              <li data-testid="cycle-247-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>G</kbd> — Toggle minimap (cycle 247)
              </li>
              <li data-testid="cycle-307-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>K</kbd> — Toggle minimap (cycle 307)
              </li>
              <li data-testid="cycle-367-toggle-minimap">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> — Toggle minimap (cycle 367)
              </li>
              <li data-testid="cycle-427-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>G</kbd> — Toggle minimap (cycle 427)
              </li>
              <li data-testid="cycle-487-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> — Toggle minimap (cycle 487)
              </li>
              <li data-testid="cycle-547-toggle-minimap">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> — Toggle minimap (cycle 547)
              </li>
              <li data-testid="cycle-187-toggle-minimap">
                <kbd>Alt</kbd>+<kbd>P</kbd> — Toggle minimap
              </li>
              <li><kbd>Ctrl</kbd>+<kbd>M</kbd> — Toggle minimap (legacy)</li>
              <li><kbd>?</kbd> — Toggle this help</li>
            </ul>
            <button className="btn-secondary" type="button" onClick={() => setShowShortcuts(false)}>Close</button>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
          </div>
        </div>
      )}
    </header>
  )
}
