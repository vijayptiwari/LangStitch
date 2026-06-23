import { useMemo } from 'react'
import { Copy, Download } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { generatePythonCode, exportGraphDocument } from '../../lib/codegen/pythonGenerator'

export function CodePanel() {
  const graphDoc = useGraphStore((s) => s.document)
  const canvasByGraph = useGraphStore((s) => s.canvasByGraph)
  const getProjectPayload = useGraphStore((s) => s.getProjectPayload)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)

  const pythonCode = useMemo(
    () => generatePythonCode(graphDoc, nodes, edges, canvasByGraph),
    [graphDoc, nodes, edges, canvasByGraph],
  )

  const copyCode = async () => {
    await navigator.clipboard.writeText(pythonCode)
  }

  const downloadPython = () => {
    const blob = new Blob([pythonCode], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${graphDoc.name || 'graph'}.py`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadProject = () => {
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

  return (
    <div className="code-panel" data-testid="code-panel">
      <div className="code-panel-header">
        <h3>Generated Python</h3>
        <div className="code-actions">
          <button className="btn-secondary-sm" onClick={copyCode} type="button">
            <Copy size={14} /> Copy
          </button>
          <button className="btn-secondary-sm" onClick={downloadPython} type="button">
            <Download size={14} /> .py
          </button>
          <button className="btn-secondary-sm" onClick={downloadProject} type="button">
            <Download size={14} /> .langstitch.json
          </button>
        </div>
      </div>
      <pre className="code-block" data-testid="code-block">{pythonCode}</pre>
    </div>
  )
}
