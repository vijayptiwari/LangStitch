import { useEffect, useRef } from 'react'
import { useIdeStore } from '../../store/ideStore'

export function DebugConsolePanel() {
  const debugLog = useIdeStore((s) => s.debugLog)
  const debugActive = useIdeStore((s) => s.debugActive)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = preRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [debugLog])

  return (
    <pre ref={preRef} className="output-log" data-testid="debug-console">
      {debugActive
        ? debugLog.length > 0
          ? debugLog.join('')
          : 'Waiting for debugger on port 5678…\n'
        : 'Debug console — set breakpoints in the code view and start debugging.\n'}
    </pre>
  )
}
