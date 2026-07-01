import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel, useReactFlow, type Node } from '@xyflow/react'
import { Search, X } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import type { StitchNodeData } from '../../types/graph'

interface SearchHit {
  kind: 'node' | 'edge'
  id: string
  label: string
  detail: string
  nodeId: string
}

function nodeHaystack(node: Node<StitchNodeData>): string {
  const data = node.data ?? ({} as StitchNodeData)
  try {
    return `${node.id} ${JSON.stringify(data)}`.toLowerCase()
  } catch {
    return `${node.id} ${String(data.label ?? '')}`.toLowerCase()
  }
}

export function CanvasSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const selectNode = useGraphStore((s) => s.selectNode)
  const { getNode, setCenter } = useReactFlow()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (open) {
      setActiveIndex(0)
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: SearchHit[] = []
    for (const n of nodes) {
      if (n.data?.kind === 'start' || n.data?.kind === 'end') continue
      if (nodeHaystack(n).includes(q)) {
        out.push({
          kind: 'node',
          id: n.id,
          label: String(n.data?.label ?? n.id),
          detail: String(n.data?.kind ?? 'node'),
          nodeId: n.id,
        })
      }
    }
    for (const e of edges) {
      const label = String(e.label ?? '')
      if (label && label.toLowerCase().includes(q)) {
        const from = nodes.find((n) => n.id === e.source)?.data?.label ?? e.source
        const to = nodes.find((n) => n.id === e.target)?.data?.label ?? e.target
        out.push({
          kind: 'edge',
          id: e.id,
          label,
          detail: `${from} → ${to}`,
          nodeId: e.source,
        })
      }
    }
    return out.slice(0, 50)
  }, [query, nodes, edges])

  const focusHit = (hit: SearchHit | undefined) => {
    if (!hit) return
    const node = getNode(hit.nodeId)
    if (!node) return
    selectNode(hit.nodeId)
    const w = node.measured?.width ?? node.width ?? 180
    const h = node.measured?.height ?? node.height ?? 80
    void setCenter(node.position.x + w / 2, node.position.y + h / 2, {
      zoom: 1.1,
      duration: 350,
    })
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <Panel position="top-center" className="canvas-search" data-testid="canvas-search">
      <div className="canvas-search-bar">
        <Search size={14} className="canvas-search-icon" />
        <input
          ref={inputRef}
          className="canvas-search-input"
          data-testid="canvas-search-input"
          placeholder="Search nodes, data, transitions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (hits.length === 0) return
              const next = e.shiftKey
                ? (activeIndex - 1 + hits.length) % hits.length
                : (activeIndex + (query && hits[activeIndex] ? 1 : 0)) % hits.length
              const idx = hits[activeIndex] ? activeIndex : 0
              focusHit(hits[idx])
              setActiveIndex(next)
            }
          }}
        />
        <span className="canvas-search-count">
          {query ? `${hits.length}` : ''}
        </span>
        <button
          type="button"
          className="canvas-search-close"
          onClick={onClose}
          aria-label="Close search"
          data-testid="canvas-search-close"
        >
          <X size={14} />
        </button>
      </div>
      {query && (
        <div className="canvas-search-results" data-testid="canvas-search-results">
          {hits.length === 0 ? (
            <div className="canvas-search-empty">No matches</div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                className={`canvas-search-result${i === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => focusHit(hit)}
              >
                <span className={`canvas-search-tag ${hit.kind}`}>{hit.kind === 'edge' ? 'edge' : hit.detail}</span>
                <span className="canvas-search-label">{hit.label}</span>
                {hit.kind === 'edge' && <span className="canvas-search-sub">{hit.detail}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </Panel>
  )
}
