import type {
  ComponentManifest,
  PortableComponentFile,
} from '../types/component'
import { ICON_MAP } from './customComponents'

const SLUG = /^[a-z][a-z0-9_]*$/
const DEF_NODE_NAME = /(?:async\s+)?def\s+\{\{\s*nodeName\s*\}\}/

export interface ManifestValidation {
  errors: string[]
  warnings: string[]
}

const PORT_SIDES = new Set(['left', 'right'])
const PORT_MULTIPLICITIES = new Set(['single', 'multi'])
const FIELD_KINDS = new Set([
  'string',
  'number',
  'boolean',
  'select',
  'code',
  'secret',
  'json',
  'ref',
  'multiref',
  'list',
  'group',
])
const REF_KINDS = new Set(['ref', 'multiref'])
const REF_SOURCES = new Set([
  'tools',
  'agents',
  'skills',
  'guardrails',
  'personas',
  'pipelines',
  'mcp',
  'subgraphs',
])
const CATEGORIES = new Set(['node', 'connector', 'adaptor'])

/** Validate a manifest (used by the designer save path and on import). */
export function validateManifest(m: ComponentManifest): ManifestValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!m || typeof m !== 'object') {
    return { errors: ['Manifest is not an object'], warnings }
  }

  if (!m.id || !SLUG.test(m.id)) {
    errors.push('Component id must be a slug ([a-z][a-z0-9_]*).')
  }
  if (!m.label?.trim()) errors.push('Label is required.')
  if (!CATEGORIES.has(m.category)) errors.push(`Invalid category: ${m.category}`)

  // Ports
  const portIds = new Set<string>()
  for (const p of m.ports ?? []) {
    if (!p.id || !SLUG.test(p.id)) errors.push(`Port id must be a slug: ${p.id}`)
    if (portIds.has(p.id)) errors.push(`Duplicate port id: ${p.id}`)
    portIds.add(p.id)
    if (!PORT_SIDES.has(p.side)) errors.push(`Invalid port side for ${p.id}: ${p.side}`)
    if (!PORT_MULTIPLICITIES.has(p.multiplicity)) {
      errors.push(`Invalid port multiplicity for ${p.id}: ${p.multiplicity}`)
    }
  }

  // Config fields
  const fieldIds = new Set<string>()
  for (const f of m.configFields ?? []) {
    if (!f.id || !SLUG.test(f.id)) errors.push(`Field id must be a slug: ${f.id}`)
    if (fieldIds.has(f.id)) errors.push(`Duplicate field id: ${f.id}`)
    fieldIds.add(f.id)
    if (!FIELD_KINDS.has(f.kind)) errors.push(`Invalid field kind for ${f.id}: ${f.kind}`)
    if (f.kind === 'select' && !(f.options && f.options.length > 0)) {
      errors.push(`Select field "${f.id}" requires at least one option.`)
    }
    if (REF_KINDS.has(f.kind)) {
      if (!f.source) {
        errors.push(`Reference field "${f.id}" requires a "source" registry binding.`)
      } else if (!REF_SOURCES.has(f.source)) {
        errors.push(`Field "${f.id}" has an invalid ref source: ${f.source}`)
      }
    }
    if (
      typeof f.min === 'number' &&
      typeof f.max === 'number' &&
      f.min > f.max
    ) {
      errors.push(`Field "${f.id}": min (${f.min}) must be ≤ max (${f.max}).`)
    }
    if (f.pattern) {
      try {
        new RegExp(f.pattern)
      } catch {
        warnings.push(`Field "${f.id}" has an invalid regex pattern; it will be ignored.`)
      }
    }
  }

  // Theme
  if (m.theme?.icon && !(m.theme.icon in ICON_MAP)) {
    warnings.push(`Unknown icon "${m.theme.icon}" — falling back to "box".`)
  }

  // Codegen template
  if (!m.codegen?.template?.trim()) {
    errors.push('Codegen template is required.')
  } else if (!DEF_NODE_NAME.test(m.codegen.template)) {
    errors.push('Template must define `def {{nodeName}}(state: State) -> dict:`.')
  }

  return { errors, warnings }
}

/** True when the manifest has no hard validation errors. */
export function isManifestValid(m: ComponentManifest): boolean {
  return validateManifest(m).errors.length === 0
}

/** Serialize a manifest into the portable `.component.json` wrapper (§5.6). */
export function serializeComponent(manifest: ComponentManifest): string {
  const file: PortableComponentFile = {
    langstitchComponent: '1.0',
    exportedAt: new Date().toISOString(),
    manifest,
  }
  return JSON.stringify(file, null, 2)
}

export interface ParseResult {
  manifest?: ComponentManifest
  errors: string[]
  warnings: string[]
}

/** Parse + validate a portable `.component.json` text payload. */
export function parseComponentFile(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { errors: ['File is not valid JSON.'], warnings: [] }
  }

  const obj = parsed as Partial<PortableComponentFile>
  if (!obj || obj.langstitchComponent !== '1.0' || !obj.manifest) {
    return { errors: ['Not a valid .component.json file (missing langstitchComponent / manifest).'], warnings: [] }
  }

  const manifest = obj.manifest as ComponentManifest
  const { errors, warnings } = validateManifest(manifest)
  if (errors.length) return { errors, warnings }
  return { manifest, errors: [], warnings }
}

/** Build a non-colliding copy id given the existing registry. */
export function makeCopyId(baseId: string, existingIds: string[]): string {
  const taken = new Set(existingIds)
  let candidate = `${baseId}_copy_${Math.random().toString(36).slice(2, 7)}`
  while (taken.has(candidate)) {
    candidate = `${baseId}_copy_${Math.random().toString(36).slice(2, 7)}`
  }
  return candidate
}

/** Slugify free text into a valid component/field/port id. */
export function slugifyId(text: string, fallback = 'component'): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1')
  return slug || fallback
}
