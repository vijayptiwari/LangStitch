import type { ReactNode } from 'react'
import { ActivityBar } from './ActivityBar'
import { SidePanel } from './SidePanel'
import { BottomPanel } from './BottomPanel'
import { StatusBar } from './StatusBar'
import { EditorTabs } from './EditorTabs'
import { DebugFlowTracker } from './DebugFlowTracker'
import { CommandPalette, QuickOpen } from './CommandPalette'
import { WelcomeScreen, ToastContainer } from './WelcomeScreen'
import { useIdeStore } from '../../store/ideStore'
import { registerIdeTestHooks } from '../../lib/ideTestHooks'
import { useGraphSync } from '../../hooks/useGraphSync'
import { useIdeHost, usePythonDiagnostics } from '../../hooks/useIdeHost'
import { useEffect } from 'react'

interface IdeLayoutProps {
  children: ReactNode
  codeView: ReactNode
}

export function IdeLayout({ children, codeView }: IdeLayoutProps) {
  const viewMode = useIdeStore((s) => s.viewMode)
  const welcomeVisible = useIdeStore((s) => s.welcomeVisible)
  const setCommandPaletteOpen = useIdeStore((s) => s.setCommandPaletteOpen)
  const setQuickOpenOpen = useIdeStore((s) => s.setQuickOpenOpen)
  const setBottomPanel = useIdeStore((s) => s.setBottomPanel)

  const virtualFiles = useIdeStore((s) => s.virtualFiles)

  useGraphSync()
  useIdeHost()
  usePythonDiagnostics(virtualFiles)

  useEffect(() => {
    registerIdeTestHooks()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpenOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setBottomPanel('terminal')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandPaletteOpen, setQuickOpenOpen, setBottomPanel])

  return (
    <div className="ide-shell" data-testid="ide-shell">
      <div className="ide-shell-body">
        <ActivityBar />
        <SidePanel />
        <div className="ide-main">
          <EditorTabs />
          <div className="ide-editor-area">
            {welcomeVisible ? (
              <WelcomeScreen />
            ) : viewMode === 'canvas' ? (
              children
            ) : (
              codeView
            )}
          </div>
          <BottomPanel />
        </div>
      </div>
      <DebugFlowTracker />
      <StatusBar />
      <CommandPalette />
      <QuickOpen />
      <ToastContainer />
    </div>
  )
}
