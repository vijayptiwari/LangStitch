import { Panel, useReactFlow } from '@xyflow/react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Download,
  Wand2,
} from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { downloadGraphImage, isVsCode } from '../../webview/vscodeBridge'
import type { AlignMode } from '../../lib/layout/autoLayout'

function AlignBtn({
  mode,
  title,
  testId,
  children,
}: {
  mode: AlignMode
  title: string
  testId: string
  children: React.ReactNode
}) {
  const alignSelection = useGraphStore((s) => s.alignSelection)
  const locked = useGraphStore((s) => s.document.settings?.locked)
  return (
    <button
      type="button"
      className="canvas-panel-btn"
      title={title}
      data-testid={testId}
      disabled={locked}
      onClick={() => alignSelection(mode)}
    >
      {children}
    </button>
  )
}

export function CanvasControlsPanel() {
  const { fitView } = useReactFlow()
  const beautifyActiveCanvas = useGraphStore((s) => s.beautifyActiveCanvas)
  const locked = useGraphStore((s) => s.document.settings?.locked)
  const selectedCount = useGraphStore((s) => s.nodes.filter((n) => n.selected).length)

  const handleBeautify = () => {
    beautifyActiveCanvas()
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }))
  }

  const handleExportImage = async () => {
    if (isVsCode()) {
      /* host handles via command palette export */
      return
    }
    await downloadGraphImage('jpeg')
  }

  return (
    <Panel position="top-right" className="canvas-controls-panel">
      <button
        type="button"
        className="canvas-panel-btn"
        data-testid="canvas-beautify"
        title="Beautify layout"
        disabled={locked}
        onClick={handleBeautify}
      >
        <Wand2 size={14} />
        Beautify
      </button>
      <button
        type="button"
        className="canvas-panel-btn"
        data-testid="canvas-export-image"
        title="Export diagram (JPEG)"
        onClick={() => void handleExportImage()}
      >
        <Download size={14} />
        Image
      </button>
      {selectedCount >= 1 && (
        <div className="canvas-align-cluster" data-testid="canvas-align-cluster">
          <AlignBtn mode="left" title="Align left" testId="align-left"><AlignLeft size={13} /></AlignBtn>
          <AlignBtn mode="hcenter" title="Align center" testId="align-hcenter"><AlignCenterHorizontal size={13} /></AlignBtn>
          <AlignBtn mode="right" title="Align right" testId="align-right"><AlignRight size={13} /></AlignBtn>
          <AlignBtn mode="top" title="Align top" testId="align-top"><AlignStartVertical size={13} /></AlignBtn>
          <AlignBtn mode="vcenter" title="Align middle" testId="align-vcenter"><AlignCenterVertical size={13} /></AlignBtn>
          <AlignBtn mode="bottom" title="Align bottom" testId="align-bottom"><AlignEndVertical size={13} /></AlignBtn>
        </div>
      )}
    </Panel>
  )
}
