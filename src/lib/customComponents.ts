import {
  Box,
  Bot,
  Brain,
  Cable,
  Cloud,
  Code2,
  Cpu,
  Database,
  GitBranch,
  Globe,
  Layers,
  Plug,
  Puzzle,
  Rss,
  Server,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentManifest, ConfigField } from '../types/component'
import { BUILTIN_IDS, BUILTIN_MANIFESTS } from './builtinManifests'

export const ICON_MAP: Record<string, LucideIcon> = {
  box: Box,
  puzzle: Puzzle,
  plug: Plug,
  cable: Cable,
  cloud: Cloud,
  cpu: Cpu,
  database: Database,
  globe: Globe,
  server: Server,
  rss: Rss,
  zap: Zap,
  code: Code2,
  brain: Brain,
  bot: Bot,
  wrench: Wrench,
  layers: Layers,
  'git-branch': GitBranch,
  sparkles: Sparkles,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export function resolveIcon(icon: string | undefined): LucideIcon {
  if (icon && icon in ICON_MAP) return ICON_MAP[icon]
  return Box
}

export interface CustomPaletteItem {
  componentId: string
  label: string
  description: string
  category: ComponentManifest['category']
  icon: string
  color: string
}

export function customPaletteItems(registry: ComponentManifest[] | undefined): CustomPaletteItem[] {
  return (registry ?? [])
    .filter((m) => !BUILTIN_IDS.has(m.id))
    .map((m) => ({
      componentId: m.id,
      label: m.label,
      description: m.description,
      category: m.category,
      icon: m.theme.icon,
      color: m.theme.color,
    }))
}

export function resolveComponent(
  registry: ComponentManifest[] | undefined,
  componentId: string,
): ComponentManifest | undefined {
  return (registry ?? []).find((m) => m.id === componentId)
}

export function defaultValueForField(field: ConfigField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue
  switch (field.kind) {
    case 'boolean':
      return false
    case 'number':
      return field.min ?? 0
    case 'select':
      return field.options?.[0]?.value ?? ''
    case 'multiref':
    case 'list':
      return []
    case 'group':
      return {}
    case 'ref':
      return ''
    default:
      return ''
  }
}

export function getBuiltinRegistry(userManifests: ComponentManifest[] = []): ComponentManifest[] {
  const customs = (userManifests ?? []).filter((m) => !BUILTIN_IDS.has(m.id))
  return [...BUILTIN_MANIFESTS, ...customs]
}

export function mergeComponentRegistry(existing: ComponentManifest[] | undefined): ComponentManifest[] {
  return getBuiltinRegistry(existing ?? [])
}

export function buildDefaultConfig(manifest: ComponentManifest): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const field of manifest.configFields) {
    config[field.id] = defaultValueForField(field)
  }
  return config
}
