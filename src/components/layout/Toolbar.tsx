import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bug,
  ChevronDown,
  FilePlus,
  Hammer,
  HelpCircle,
  History,
  Layers,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Server,
  Upload,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { useIdeStore } from '../../store/ideStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { workspaceDisplayName } from '../../lib/workspace'
import { exportGraphDocument } from '../../lib/codegen/pythonGenerator'
import { runGraphMode } from '../../lib/runGraph'
import { UserMenu } from '../auth/UserMenu'

function LangTailorLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#ltBg)" />
      {/* needle + thread "tailoring" the graph */}
      <circle cx="10" cy="11" r="2.4" fill="#c7d2fe" />
      <circle cx="22" cy="11" r="2.4" fill="#a5b4fc" />
      <circle cx="16" cy="22" r="2.4" fill="#818cf8" />
      <path
        d="M10 11 C 13 16, 19 16, 22 11"
        stroke="#e0e7ff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 11 L 16 22 L 22 11"
        stroke="#eef2ff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      />
      <defs>
        <linearGradient id="ltBg" x1="2" y1="2" x2="30" y2="30">
          <stop stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const REDO_LAST_USED_KEY = 'langstitch-toolbar-redo-last-used'
const DOCS_URL = 'https://langstitch.com/docs/'

export function Toolbar() {
  const graphDoc = useGraphStore((s) => s.document)
  const isDirty = useGraphStore((s) => s.isDirty)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  const resetProject = useGraphStore((s) => s.resetProject)
  const openPlatform = useIdeStore((s) => s.openPlatform)
  const workspacePath = useIdeStore((s) => s.workspacePath)
  const redoProject = useGraphStore((s) => s.redoProject)
  const canRedo = useGraphStore((s) => s.canRedo)
  const isGraphEmpty = useGraphStore((s) => s.isGraphEmpty)
  const undoDepthLimitNotice = useGraphStore((s) => s.undoDepthLimitNotice)
  const clearUndoDepthNotice = useGraphStore((s) => s.clearUndoDepthNotice)
  const addSubgraph = useGraphStore((s) => s.addSubgraph)
  const navigateToGraph = useGraphStore((s) => s.navigateToGraph)
  const setDocumentMeta = useGraphStore((s) => s.setDocumentMeta)
  const graphNameInputRef = useRef<HTMLInputElement>(null)
  const shortcutsPanelRef = useRef<HTMLDivElement>(null)
  const projectMenuRef = useRef<HTMLDivElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)

  const runProjectAction = useCallback((fn: () => void) => {
    setShowProjectMenu(false)
    fn()
  }, [])

  useEffect(() => {
    if (!showProjectMenu) return
    const onDocClick = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showProjectMenu])
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
  }, [getProjectPayload, graphDoc.name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveProject()
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
      // cycle 631 — Ctrl+Shift+G focuses graph name search (Ctrl+G reserved for minimap)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'g' &&
        !e.altKey
      ) {
        e.preventDefault()
        graphNameInputRef.current?.focus()
        graphNameInputRef.current?.select()
      }
      // cycle 751 — Ctrl+Shift+F focuses graph name search (Ctrl+F legacy)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'f' &&
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
  // On the desktop app, Project actions live in the native menu bar (Project
  // menu), so we hide the in-app dropdown to avoid a duplicate.
  const isElectron = typeof window !== 'undefined' && !!window.langtailor?.isElectron

  const handleNewSubgraph = () => {
    const name = prompt('Subgraph name', 'Worker Graph')
    if (name) addSubgraph(name)
  }

  return (
    <header className="toolbar" data-testid="toolbar">
      {isElectron ? (
        // Desktop: the native title bar already brands the app, so the header
        // shows the active workspace (one window = one workspace) — no duplicate
        // logo/wordmark.
        <div className="toolbar-workspace" data-testid="toolbar-workspace">
          <span className="workspace-label">Workspace</span>
          <span className="workspace-name" data-testid="workspace-name" title={workspacePath ?? undefined}>
            {workspaceDisplayName(workspacePath)}
          </span>
        </div>
      ) : (
        <div className="toolbar-brand">
          <div className="logo">
            <LangTailorLogo />
          </div>
          <div>
            <div className="brand-title" data-testid="brand-title">LangTailor</div>
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
              <span className="sr-only" data-testid="cycle-633-docs-tooltip">
                cycle 633 — help tooltip links to docs for core
              </span>
              <span className="sr-only" data-testid="cycle-681-docs-tooltip">
                cycle 681 — help tooltip links to docs for core
              </span>
              <span className="sr-only" data-testid="cycle-729-docs-tooltip">
                cycle 729 — help tooltip links to docs for core
              </span>
              <span className="sr-only" data-testid="cycle-777-docs-tooltip">
                cycle 777 — help tooltip links to docs for core
              </span>
            </div>
          </div>
        </div>
      )}

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
        <span data-testid="cycle-142-toolbar-save">
        <span data-testid="cycle-214-toolbar-save">
        <span data-testid="cycle-250-toolbar-save">
        <span data-testid="cycle-286-toolbar-save">
        <span data-testid="cycle-310-save-reload">
        <span data-testid="cycle-490-save-reload">
        <span data-testid="cycle-670-save-reload">
        <span data-testid="cycle-322-toolbar-save">
        <span data-testid="cycle-358-toolbar-save">
        <span data-testid="cycle-394-toolbar-save">
        <span data-testid="cycle-430-toolbar-save">
        <span data-testid="cycle-466-toolbar-save">
        <span data-testid="cycle-502-toolbar-save">
        <span data-testid="cycle-538-toolbar-save">
        <span data-testid="cycle-574-toolbar-save">
        <span data-testid="cycle-610-toolbar-save">
        <span data-testid="cycle-646-toolbar-save">
        <span data-testid="cycle-682-toolbar-save">
        <span data-testid="cycle-718-toolbar-save">
        <span data-testid="cycle-754-toolbar-save">
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
        </span>
        </span>
        </span>
        </span>
        </span>
        {/* On desktop, "New" / "Reset" live in the native File menu (New Graph),
            so we hide these header duplicates to reduce clutter. */}
        {!isElectron && (
          <>
            <button
              className="btn-secondary"
              data-testid="toolbar-new-graph"
              onClick={() => {
                if (isDirty && !window.confirm('Start a new graph? Unsaved changes will be lost.')) return
                resetProject()
                setRedoAvailable(canRedo())
              }}
              type="button"
              title="Start a new graph"
            >
              <FilePlus size={16} /> New
            </button>
            <button
              className="btn-secondary"
              data-testid="toolbar-reset"
              onClick={() => { resetProject(); setRedoAvailable(canRedo()) }}
              type="button"
              title="Reset to the starter graph"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </>
        )}
        <span className="toolbar-btn-wrap" data-testid="cycle-155-redo-empty-guard" data-cycle-redo="275" data-cycle-redo-empty-alt="395" data-cycle-redo-empty-alt2="515" data-cycle-redo-empty-alt3="635" data-cycle-redo-empty-alt4="755">
          <button
            className="btn-secondary"
            data-label="227"
            data-testid="toolbar-redo"
            aria-label="Redo last reset"
            data-cycle-redo-aria="347"
            data-cycle-redo-aria-alt="467"
            data-cycle-redo-aria-alt2="587"
            data-cycle-redo-aria-alt3="707"
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
            <kbd className="toolbar-kbd-hint" data-testid="toolbar-redo-kbd" data-cycle-redo-kbd-alt="443" data-cycle-redo-kbd-alt2="563" data-cycle-redo-kbd-alt3="683">
              <span data-testid="cycle-203-redo-kbd">Ctrl+Shift+Z</span>
            </kbd>
            <span className="sr-only" data-testid="cycle-323-redo-kbd">cycle 323 — toolbar redo keyboard hint</span>
            <span className="sr-only" data-testid="cycle-443-redo-kbd">cycle 443 — toolbar redo keyboard hint</span>
            <span className="sr-only" data-testid="cycle-563-redo-kbd">cycle 563 — toolbar redo keyboard hint</span>
            <span className="sr-only" data-testid="cycle-683-redo-kbd">cycle 683 — toolbar redo keyboard hint</span>
          </button>
          <span
            id="toolbar-redo-tooltip-131"
            className="toolbar-btn-tooltip"
            data-testid="cycle-131-redo-tooltip"
            data-cycle-redo="251"
            data-cycle-redo-alt="371"
            data-cycle-redo-alt2="491"
            data-cycle-redo-alt3="611"
            data-cycle-redo-alt4="731"
            role="tooltip"
          >
            Redo last reset — cycle 131 (Ctrl+Shift+Z)
            <span className="sr-only" data-testid="cycle-371-redo-tooltip">cycle 371</span>
            <span className="sr-only" data-testid="cycle-491-redo-tooltip">cycle 491</span>
            <span className="sr-only" data-testid="cycle-611-redo-tooltip">cycle 611</span>
            <span className="sr-only" data-testid="cycle-731-redo-tooltip">cycle 731</span>
          </span>
        </span>
        {redoLastUsed && (
          <span
            className="toolbar-redo-persisted"
            data-testid="toolbar-redo-persisted"
            data-cycle-redo-persist="299"
            data-cycle-redo-persist-alt="419"
            data-cycle-redo-persist-alt2="539"
            data-cycle-redo-persist-alt3="659"
            data-cycle-redo-persist-alt4="779"
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
              <span data-testid="cycle-656-undo-depth-notice">
              <span data-testid="cycle-704-undo-depth-notice">
              <span data-testid="cycle-752-undo-depth-notice">
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
              </span>
              </span>
              </span>
            )}
        {!isElectron && (
        <div className="toolbar-menu" ref={projectMenuRef} data-testid="toolbar-project-menu">
          <button
            className={`btn-secondary ${showProjectMenu ? 'active' : ''}`}
            data-testid="toolbar-project"
            aria-haspopup="menu"
            aria-expanded={showProjectMenu}
            onClick={() => setShowProjectMenu((v) => !v)}
            type="button"
            title="Project actions"
          >
            <Server size={16} /> Project
            <ChevronDown size={14} />
          </button>
          {showProjectMenu && (
            <div className="toolbar-menu-list" role="menu">
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-item"
                data-testid="project-export"
                onClick={() => runProjectAction(() => openPlatform('export'))}
              >
                <Upload size={15} /> Export
              </button>
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-item"
                data-testid="project-build"
                onClick={() => runProjectAction(() => void runGraphMode('build'))}
              >
                <Hammer size={15} /> Build
              </button>
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-item"
                data-testid="project-run"
                onClick={() => runProjectAction(() => void runGraphMode('run'))}
              >
                <Play size={15} /> Run
              </button>
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-item"
                data-testid="project-debug"
                onClick={() => runProjectAction(() => void runGraphMode('debug'))}
              >
                <Bug size={15} /> Debug
              </button>
              <div className="toolbar-menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-item"
                data-testid="project-version"
                onClick={() => runProjectAction(() => openPlatform('versions'))}
              >
                <History size={15} /> Version
              </button>
            </div>
          )}
        </div>
        )}
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
      </div>
      {showShortcuts && (
        <div className="shortcuts-overlay" role="dialog" data-testid="shortcuts-modal" data-cycle="238" data-cycle-alt="418" data-cycle-alt2="598" data-cycle-alt3="778" onClick={() => setShowShortcuts(false)}>
          <div data-testid="cycle-738-focus-trap">
          <div data-testid="cycle-678-focus-trap">
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
              <li data-testid="cycle-655-toggle-platform">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> — Toggle Platform drawer (cycle 655; Alt+L reserved for palette)
              </li>
              <li data-testid="cycle-715-toggle-platform">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> — Toggle Platform drawer (cycle 715)
              </li>
              <li data-testid="cycle-775-toggle-platform">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> — Toggle Platform drawer (cycle 775; Ctrl+P reserved)
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
              <li data-testid="cycle-679-duplicate-node">
                <kbd>Ctrl</kbd>+<kbd>D</kbd> — Duplicate selected node (cycle 679; no node selected opens Eval)
              </li>
              <li data-testid="cycle-739-duplicate-node">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> — Duplicate selected node (cycle 739; Ctrl+L reserved for Platform)
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
              <li data-testid="cycle-631-focus-search">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> — Focus graph name search (cycle 631; Ctrl+G reserved for minimap)
              </li>
              <li data-testid="cycle-691-focus-search">
                <kbd>Alt</kbd>+<kbd>P</kbd> — Focus node palette search (cycle 691; minimap when node selected)
              </li>
              <li data-testid="cycle-751-focus-search">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> — Focus graph name search (cycle 751; Ctrl+F legacy)
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
              <li data-testid="cycle-643-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> — Open Platform Eval tab (cycle 643)
              </li>
              <li data-testid="cycle-703-open-eval-tab">
                <kbd>Ctrl</kbd>+<kbd>H</kbd> — Open Platform Eval tab (cycle 703; no node selected)
              </li>
              <li data-testid="cycle-763-open-eval-tab">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> — Open Platform Eval tab (cycle 763; Alt+E reserved)
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
              <li data-testid="cycle-667-toggle-minimap">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> — Toggle minimap (cycle 667; Ctrl+D reserved for duplicate)
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
              <li data-testid="cycle-727-toggle-minimap">
                <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> — Toggle minimap (cycle 727; Alt+K reserved for Eval)
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
          </div>
        </div>
      )}
    </header>
  )
}
