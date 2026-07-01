import { useEffect } from 'react'
import { useIdeStore } from '../store/ideStore'
import { useGraphStore } from '../store/graphStore'
import {
  graphToFiles,
  scheduleSyncFromCanvas,
  scheduleSyncFromCode,
  filesToGraphDeltaFromVirtual,
  applyGraphDelta,
} from '../lib/sync/codeGraphSync'
import { setDeletionConfirmHandler } from '../lib/deletionGuard'

export function useGraphSync() {
  const document = useGraphStore((s) => s.document)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const canvasByGraph = useGraphStore((s) => s.canvasByGraph)
  const navigationPath = useGraphStore((s) => s.navigationPath)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)

  const virtualFiles = useIdeStore((s) => s.virtualFiles)
  const syncSource = useIdeStore((s) => s.syncSource)
  const setVirtualFiles = useIdeStore((s) => s.setVirtualFiles)
  const updateVirtualFile = useIdeStore((s) => s.updateVirtualFile)
  const setParseDiagnostics = useIdeStore((s) => s.setParseDiagnostics)
  const setSyncSource = useIdeStore((s) => s.setSyncSource)
  const addToast = useIdeStore((s) => s.addToast)

  useEffect(() => {
    setDeletionConfirmHandler(async (req) => {
      const msg = `Node "${req.label}" (${req.kind}) contains custom code that will be permanently lost.\n\nDelete anyway?`
      if (window.langtailor?.confirm) return window.langtailor.confirm(msg)
      return window.confirm(msg)
    })
    return () => setDeletionConfirmHandler(null)
  }, [])

  useEffect(() => {
    if (syncSource === 'code') return
    setSyncSource('canvas')
    scheduleSyncFromCanvas(
      () => graphToFiles(document, nodes, edges, canvasByGraph, navigationPath),
      'canvas',
      (files) => {
        setVirtualFiles(files)
        setSyncSource(null)
      },
    )
  }, [document, nodes, edges, canvasByGraph, navigationPath, syncSource])

  useEffect(() => {
    if (syncSource !== 'code') return
    scheduleSyncFromCode(virtualFiles, 'code', (files) => {
      const { delta, parsed } = filesToGraphDeltaFromVirtual(files, nodes, edges)
      setParseDiagnostics(parsed.diagnostics)
      if (parsed.error) {
        addToast(parsed.error, 'error')
        setSyncSource(null)
        return
      }
      const structural =
        delta.nodesToAdd.length +
          delta.nodesToRemove.length +
          delta.edgesToAdd.length +
          delta.edgesToRemove.length >
        0
      if (structural) {
        const applied = applyGraphDelta(nodes, edges, delta)
        setNodes(applied.nodes)
        setEdges(applied.edges)
      } else if (delta.customCodeUpdates.length) {
        const applied = applyGraphDelta(nodes, edges, delta)
        setNodes(applied.nodes)
      }
      setSyncSource(null)
    })
  }, [virtualFiles, syncSource])

  return { updateVirtualFile, virtualFiles }
}
