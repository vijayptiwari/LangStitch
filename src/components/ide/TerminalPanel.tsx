import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useIdeStore } from '../../store/ideStore'

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)
  const [sessionKey, setSessionKey] = useState(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    setBottomPanel('terminal')
  }, [setBottomPanel])

  useEffect(() => {
    const api = window.langtailor?.terminal
    if (!api || !containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
      theme: { background: '#1a1a1a', foreground: '#d4d4d4' },
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    let unsubData: (() => void) | undefined
    void api.create(term.cols, term.rows).then(() => {
      setConnected(true)
      unsubData = api.onData((data) => term.write(data))
      term.onData((data) => api.write(data))
    })

    const onResize = () => {
      try {
        fit.fit()
        api.resize(term.cols, term.rows)
      } catch {
        /* container detached */
      }
    }
    window.addEventListener('resize', onResize)
    const observer = new ResizeObserver(onResize)
    observer.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      unsubData?.()
      void api.kill()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      setConnected(false)
    }
  }, [sessionKey])

  const clear = useCallback(() => termRef.current?.clear(), [])
  const restart = useCallback(() => setSessionKey((k) => k + 1), [])

  const hasTerminal = Boolean(window.langtailor?.terminal)

  return (
    <div className="terminal-panel" data-testid="terminal-panel">
      {hasTerminal ? (
        <>
          <div className="terminal-toolbar" data-testid="terminal-toolbar">
            <span className="terminal-tab active">
              <span className={`terminal-status-dot${connected ? ' on' : ''}`} />
              Terminal
            </span>
            <div className="terminal-toolbar-actions">
              <button type="button" className="terminal-tool-btn" title="Clear (does not kill the shell)" onClick={clear} data-testid="terminal-clear">
                <Trash2 size={14} />
              </button>
              <button type="button" className="terminal-tool-btn" title="Restart shell" onClick={restart} data-testid="terminal-restart">
                <RefreshCw size={14} />
              </button>
              <button type="button" className="terminal-tool-btn" title="New session" onClick={restart} data-testid="terminal-new">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div ref={containerRef} className="terminal-container" data-testid="terminal-xterm" />
        </>
      ) : (
        <pre className="terminal-fallback">
          Integrated terminal is available in the LangTailor desktop app.
          {'\n'}Web dev mode: use your system terminal with `npm start`.
        </pre>
      )}
    </div>
  )
}
