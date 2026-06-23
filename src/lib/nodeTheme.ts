import type { NodeKind } from '../types/graph'
import {
  Brain,
  Bot,
  Code2,
  GitBranch,
  Layers,
  Play,
  Square,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface NodeTheme {
  kind: NodeKind
  typeLabel: string
  color: string
  colorLight: string
  gradient: string
  glow: string
  edgeColor: string
  icon: LucideIcon
}

export const NODE_THEMES: Record<NodeKind, NodeTheme> = {
  start: {
    kind: 'start',
    typeLabel: 'Entry',
    color: '#34d399',
    colorLight: '#6ee7b7',
    gradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.22) 0%, rgba(16, 185, 129, 0.08) 100%)',
    glow: 'rgba(52, 211, 153, 0.45)',
    edgeColor: '#34d399',
    icon: Play,
  },
  end: {
    kind: 'end',
    typeLabel: 'Exit',
    color: '#fb7185',
    colorLight: '#fda4af',
    gradient: 'linear-gradient(135deg, rgba(251, 113, 133, 0.22) 0%, rgba(244, 63, 94, 0.08) 100%)',
    glow: 'rgba(251, 113, 133, 0.45)',
    edgeColor: '#fb7185',
    icon: Square,
  },
  llm: {
    kind: 'llm',
    typeLabel: 'LLM',
    color: '#a78bfa',
    colorLight: '#c4b5fd',
    gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.28) 0%, rgba(139, 92, 246, 0.1) 100%)',
    glow: 'rgba(167, 139, 250, 0.5)',
    edgeColor: '#a78bfa',
    icon: Brain,
  },
  tool: {
    kind: 'tool',
    typeLabel: 'Tool',
    color: '#fbbf24',
    colorLight: '#fcd34d',
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(245, 158, 11, 0.1) 100%)',
    glow: 'rgba(251, 191, 36, 0.45)',
    edgeColor: '#fbbf24',
    icon: Wrench,
  },
  agent: {
    kind: 'agent',
    typeLabel: 'Agent',
    color: '#2dd4bf',
    colorLight: '#5eead4',
    gradient: 'linear-gradient(135deg, rgba(45, 212, 191, 0.28) 0%, rgba(20, 184, 166, 0.1) 100%)',
    glow: 'rgba(45, 212, 191, 0.5)',
    edgeColor: '#2dd4bf',
    icon: Bot,
  },
  router: {
    kind: 'router',
    typeLabel: 'Decision',
    color: '#38bdf8',
    colorLight: '#7dd3fc',
    gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.1) 100%)',
    glow: 'rgba(56, 189, 248, 0.5)',
    edgeColor: '#38bdf8',
    icon: GitBranch,
  },
  function: {
    kind: 'function',
    typeLabel: 'Function',
    color: '#94a3b8',
    colorLight: '#cbd5e1',
    gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.2) 0%, rgba(100, 116, 139, 0.08) 100%)',
    glow: 'rgba(148, 163, 184, 0.35)',
    edgeColor: '#94a3b8',
    icon: Code2,
  },
  subgraph: {
    kind: 'subgraph',
    typeLabel: 'Subgraph',
    color: '#f472b6',
    colorLight: '#f9a8d4',
    gradient: 'linear-gradient(135deg, rgba(244, 114, 182, 0.28) 0%, rgba(236, 72, 153, 0.1) 100%)',
    glow: 'rgba(244, 114, 182, 0.5)',
    edgeColor: '#f472b6',
    icon: Layers,
  },
}

export function getNodeTheme(kind: NodeKind): NodeTheme {
  return NODE_THEMES[kind]
}

export function getNodeColor(kind: string | undefined): string {
  if (kind && kind in NODE_THEMES) {
    return NODE_THEMES[kind as NodeKind].color
  }
  return '#64748b'
}
