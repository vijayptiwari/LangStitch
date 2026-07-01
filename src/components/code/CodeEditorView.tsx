import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useRef } from 'react'
import '../../lib/monacoSetup'
import { useIdeStore } from '../../store/ideStore'
import { useGraphStore } from '../../store/graphStore'
import { virtualNodePath } from '../../lib/codegen/nodeModuleCodegen'
import { pathToNodeId } from '../../lib/breakpoints'

// Module-level so the "open an entry file on first launch" convenience fires
// exactly once per app session — and never fights the user when they close
// tabs (including the last one) or toggle between Canvas and Code views.
let didAutoOpenOnce = false

export function CodeEditorView() {
  const virtualFiles = useIdeStore((s) => s.virtualFiles)
  const activeFilePath = useIdeStore((s) => s.activeFilePath)
  const updateVirtualFile = useIdeStore((s) => s.updateVirtualFile)
  const openFile = useIdeStore((s) => s.openFile)
  const breakpoints = useIdeStore((s) => s.breakpoints)
  const debugNodeId = useIdeStore((s) => s.debugNodeId)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const selectNode = useGraphStore((s) => s.selectNode)
  const document = useGraphStore((s) => s.document)
  const nodes = useGraphStore((s) => s.nodes)

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)
  const decorationsRef = useRef<string[]>([])

  useEffect(() => {
    if (!selectedNodeId) return
    const path = virtualNodePath(document, selectedNodeId)
    if (path && virtualFiles[path]) openFile(path)
  }, [selectedNodeId, document, virtualFiles, openFile])

  // Code mode is the default IDE experience — open a sensible entry file ONCE so
  // the editor is never blank on first launch. This must not re-fire when the
  // user closes their last tab, otherwise tabs become impossible to close.
  useEffect(() => {
    if (didAutoOpenOnce) return
    if (activeFilePath) {
      didAutoOpenOnce = true
      return
    }
    const pyFiles = Object.keys(virtualFiles)
      .filter((p) => p.endsWith('.py') && !p.endsWith('__init__.py'))
      .sort()
    if (pyFiles.length === 0) return
    const preferred =
      pyFiles.find((p) => /\/(graph|main)\.py$/.test(p)) ??
      pyFiles.find((p) => p.endsWith('graph.py')) ??
      pyFiles[0]
    didAutoOpenOnce = true
    openFile(preferred)
  }, [activeFilePath, virtualFiles, openFile])

  const onChange = useCallback(
    (value: string | undefined) => {
      if (!activeFilePath || value === undefined) return
      updateVirtualFile(activeFilePath, value)
    },
    [activeFilePath, updateVirtualFile],
  )

  // ── Breakpoint + debug-line decorations ──────────────────────
  const renderDecorations = useCallback(() => {
    const ed = editorRef.current
    const monaco = monacoRef.current
    if (!ed || !monaco || !activeFilePath) return
    const lines = breakpoints[activeFilePath] ?? []
    const decos: editor.IModelDeltaDecoration[] = lines.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'code-breakpoint-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint — also shown on canvas' },
      },
    }))

    // Highlight the line of the node currently executing under the debugger.
    if (debugNodeId) {
      const dbgPath = virtualNodePath(document, debugNodeId)
      if (dbgPath === activeFilePath) {
        decos.push({
          range: new monaco.Range(1, 1, 1, 1),
          options: {
            isWholeLine: true,
            className: 'code-debug-line',
            glyphMarginClassName: 'code-debug-arrow',
          },
        })
      }
    }

    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, decos)
  }, [activeFilePath, breakpoints, debugNodeId, document])

  useEffect(() => {
    renderDecorations()
  }, [renderDecorations, virtualFiles])

  const handleMount = useCallback<OnMount>(
    (ed, monaco) => {
      editorRef.current = ed
      monacoRef.current = monaco
      ed.updateOptions({ glyphMargin: true })

      // Toggle a breakpoint when the glyph margin is clicked.
      ed.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const line = e.target.position?.lineNumber
          const path = useIdeStore.getState().activeFilePath
          if (line && path) useIdeStore.getState().toggleBreakpoint(path, line)
        }
      })
      renderDecorations()
    },
    [renderDecorations],
  )

  const activeNodeId = activeFilePath ? pathToNodeId(document, nodes, activeFilePath) : null

  return (
    <div className="code-editor-view" data-testid="code-editor-view">
      <div className="code-editor-body">
        <div className="code-monaco-wrap">
          {activeFilePath && virtualFiles[activeFilePath] !== undefined ? (
            <>
              {activeNodeId && (
                <div className="code-node-link">
                  <span className="code-node-link-dot" />
                  Linked to canvas node
                  <button
                    type="button"
                    className="code-node-link-btn"
                    onClick={() => {
                      selectNode(activeNodeId)
                      useIdeStore.getState().setViewMode('canvas')
                    }}
                  >
                    Reveal on canvas
                  </button>
                </div>
              )}
              <Editor
                height="100%"
                language="python"
                theme="vs-dark"
                path={activeFilePath}
                value={virtualFiles[activeFilePath]}
                onChange={onChange}
                onMount={handleMount}
                options={{
                  glyphMargin: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </>
          ) : (
            <div className="code-empty">
              Open a file from the Explorer, or select a node on the canvas.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
