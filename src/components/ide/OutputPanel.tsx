import { useEffect, useRef } from 'react'
import { useIdeStore } from '../../store/ideStore'

export function OutputPanel() {
  const outputLog = useIdeStore((s) => s.outputLog)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = preRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [outputLog])

  return (
    <pre ref={preRef} className="output-log" data-testid="output-panel">
      {outputLog.length === 0 ? 'LangTailor output appears here.\n' : outputLog.join('')}
    </pre>
  )
}
