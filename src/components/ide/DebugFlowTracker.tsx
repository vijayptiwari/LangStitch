import { useEffect, useRef } from 'react'
import { useIdeStore } from '../../store/ideStore'
import { useGraphStore } from '../../store/graphStore'
import { slugify } from '../../lib/nodeRegistry'

/**
 * Bridges runtime debug/output logs to the canvas: when the running graph emits
 * an audit event (`node_enter` / `node_exit`), the matching canvas node is
 * highlighted so the user can watch control flow move across the graph. This is
 * the "pull the debug onto the canvas" half of the bidirectional debugging.
 *
 * Generated nodes log their name as `slugify(node.id)` (see pythonGenerator), so
 * we reverse that to find the node id.
 */
export function DebugFlowTracker() {
  const debugLog = useIdeStore((s) => s.debugLog)
  const outputLog = useIdeStore((s) => s.outputLog)
  const debugActive = useIdeStore((s) => s.debugActive)
  const setDebugNodeId = useIdeStore((s) => s.setDebugNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const lastSeen = useRef(0)

  useEffect(() => {
    if (!debugActive) {
      setDebugNodeId(null)
      lastSeen.current = 0
    }
  }, [debugActive, setDebugNodeId])

  useEffect(() => {
    if (!debugActive) return
    const combined = [...debugLog, ...outputLog]
    // Only scan lines we haven't processed yet to keep this cheap.
    const fresh = combined.slice(lastSeen.current)
    lastSeen.current = combined.length
    if (fresh.length === 0) return

    const slugToId = new Map<string, string>()
    for (const n of nodes) slugToId.set(slugify(n.id), n.id)

    // Walk newest → oldest so the most recent event wins.
    for (let i = fresh.length - 1; i >= 0; i--) {
      const line = fresh[i]
      const enter = line.match(/node_enter.*?["']node["']\s*:\s*["']([^"']+)["']/)
      if (enter) {
        const id = slugToId.get(enter[1]) ?? slugToId.get(slugify(enter[1]))
        if (id) setDebugNodeId(id)
        return
      }
      if (/\b(node_exit|workflow_complete|graph_complete|__end__)\b/.test(line)) {
        setDebugNodeId(null)
        return
      }
    }
  }, [debugLog, outputLog, debugActive, nodes, setDebugNodeId])

  return null
}
