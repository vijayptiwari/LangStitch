import type { Node } from '@xyflow/react'
import type { NodeKind, StitchNodeData } from '../types/graph'
import type { ComponentManifest } from '../types/component'
import { resolveIcon } from './customComponents'
import {
  Box,
  Brain,
  Bot,
  Code2,
  Database,
  GitBranch,
  Layers,
  Play,
  Square,
  UserCheck,
  Wand2,
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
  rag: {
    kind: 'rag',
    typeLabel: 'RAG',
    color: '#818cf8',
    colorLight: '#a5b4fc',
    gradient: 'linear-gradient(135deg, rgba(129, 140, 248, 0.28) 0%, rgba(99, 102, 241, 0.1) 100%)',
    glow: 'rgba(129, 140, 248, 0.5)',
    edgeColor: '#818cf8',
    icon: Database,
  },
  intent_classifier: {
    kind: 'intent_classifier',
    typeLabel: 'Intents',
    color: '#e879f9',
    colorLight: '#f0abfc',
    gradient: 'linear-gradient(135deg, rgba(232, 121, 249, 0.28) 0%, rgba(192, 38, 211, 0.1) 100%)',
    glow: 'rgba(232, 121, 249, 0.5)',
    edgeColor: '#e879f9',
    icon: GitBranch,
  },
  hitl: {
    kind: 'hitl',
    typeLabel: 'Human',
    color: '#f59e0b',
    colorLight: '#fbbf24',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(217, 119, 6, 0.1) 100%)',
    glow: 'rgba(245, 158, 11, 0.5)',
    edgeColor: '#f59e0b',
    icon: UserCheck,
  },
  response_transformer: {
    kind: 'response_transformer',
    typeLabel: 'Transform',
    color: '#22d3ee',
    colorLight: '#67e8f9',
    gradient: 'linear-gradient(135deg, rgba(34, 211, 238, 0.26) 0%, rgba(6, 182, 212, 0.1) 100%)',
    glow: 'rgba(34, 211, 238, 0.5)',
    edgeColor: '#22d3ee',
    icon: Wand2,
  },
  custom: {
    kind: 'custom',
    typeLabel: 'Custom',
    color: '#7c89ff',
    colorLight: '#a5b0ff',
    gradient: 'linear-gradient(135deg, rgba(124, 137, 255, 0.26) 0%, rgba(99, 102, 241, 0.1) 100%)',
    glow: 'rgba(124, 137, 255, 0.48)',
    edgeColor: '#7c89ff',
    icon: Box,
  },
}

export function getNodeTheme(kind: NodeKind): NodeTheme {
  return NODE_THEMES[kind]
}

/**
 * Resolve the rendered theme for a node. For `custom` nodes, overlay the
 * manifest theme (color/icon/typeLabel) onto the `custom` base theme.
 */
export function getThemeForNode(
  node: Node<StitchNodeData>,
  registry?: ComponentManifest[],
): NodeTheme {
  const base = NODE_THEMES[node.data.kind]
  if (node.data.kind !== 'custom') return base
  const manifest = (registry ?? []).find((m) => m.id === node.data.componentId)
  if (!manifest) return base
  return {
    ...base,
    color: manifest.theme.color || base.color,
    colorLight: manifest.theme.colorLight || base.colorLight,
    edgeColor: manifest.theme.color || base.edgeColor,
    typeLabel: manifest.theme.typeLabel || base.typeLabel,
    icon: resolveIcon(manifest.theme.icon),
  }
}

export function getNodeColor(kind: string | undefined): string {
  if (kind && kind in NODE_THEMES) {
    return NODE_THEMES[kind as NodeKind].color
  }
  return '#64748b'
}
