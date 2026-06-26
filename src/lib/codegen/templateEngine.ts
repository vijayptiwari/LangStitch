import type { ConfigFieldKind } from '../../types/component'

/**
 * Whitelisted token grammar. Anything else → render error.
 *   {{label}} {{nodeName}} {{description}} {{outputKey}}
 *   {{field.<id>}}  {{field.<id>.raw}}
 *
 * SAFETY (NFR-4): pure regex string-substitution. NO eval, NO new Function,
 * NO dynamic import, NO arbitrary code execution.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

export interface RenderField {
  kind: ConfigFieldKind
  value: unknown
}

export interface RenderContext {
  nodeName: string
  label: string
  description: string
  outputKey: string
  fields: Record<string, RenderField>
}

export interface RenderResult {
  code: string
  errors: string[]
}

function toPythonString(value: unknown): string {
  return JSON.stringify(String(value ?? ''))
}

function toPythonNumber(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? String(n) : '0'
}

function toPythonBool(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'string') return value.toLowerCase() === 'true' ? 'True' : 'False'
  return value ? 'True' : 'False'
}

function toPythonJson(value: unknown, errors: string[], token: string): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  try {
    const parsed = JSON.parse(raw)
    return jsonToPyLiteral(parsed)
  } catch {
    errors.push(`Invalid JSON for ${token}`)
    return `# UNRESOLVED:${token}`
  }
}

/** Recursively convert a parsed JSON value to a valid Python literal expression. */
function jsonToPyLiteral(value: unknown): string {
  if (value === null) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonToPyLiteral(item)).join(', ')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${jsonToPyLiteral(v)}`,
    )
    return `{${entries.join(', ')}}`
  }
  return 'None'
}

function escapePythonStrContent(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

/** Render a registry reference (single id) as a Python string literal. */
function toPythonRef(value: unknown): string {
  return toPythonString(value)
}

/** Render a multi-reference field (list of ids) as a Python list literal. */
function toPythonMultiRef(value: unknown): string {
  const arr = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return `[${arr.map((item) => toPythonString(item)).join(', ')}]`
}

/**
 * Render a structured `list`/`group` value as a Python literal. The runtime
 * value is stored as a parsed JS object/array; a stringified payload is also
 * accepted for forward-compat with imported configs.
 */
function toPythonStructured(value: unknown, errors: string[], token: string): string {
  if (typeof value === 'string') {
    return toPythonJson(value, errors, token)
  }
  try {
    return jsonToPyLiteral(value ?? null)
  } catch {
    errors.push(`Invalid structured value for ${token}`)
    return `# UNRESOLVED:${token}`
  }
}

/** Escape a config field value into a Python literal based on its kind. */
function escapeFieldValue(
  field: RenderField,
  token: string,
  errors: string[],
): string {
  switch (field.kind) {
    case 'string':
    case 'select':
      return toPythonString(field.value)
    case 'number':
      return toPythonNumber(field.value)
    case 'boolean':
      return toPythonBool(field.value)
    case 'json':
      return toPythonJson(field.value, errors, token)
    case 'secret':
      return `os.environ.get(${toPythonString(field.value)})`
    case 'code':
      return toPythonString(field.value)
    case 'ref':
      return toPythonRef(field.value)
    case 'multiref':
      return toPythonMultiRef(field.value)
    case 'list':
    case 'group':
      return toPythonStructured(field.value, errors, token)
    default:
      return toPythonString(field.value)
  }
}

/** Compute the whitespace indentation of the line containing `offset`. */
function lineIndent(template: string, offset: number): string {
  const lineStart = template.lastIndexOf('\n', offset - 1) + 1
  const prefix = template.slice(lineStart, offset)
  const match = prefix.match(/^[ \t]*/)
  // Re-indent only when the placeholder is the first non-whitespace on the line.
  return prefix.trim() === '' ? prefix : (match ? match[0] : '')
}

/** Re-indent a multi-line raw block so continuation lines align with the placeholder column. */
function reindentRaw(code: string, indent: string): string {
  const lines = String(code).split('\n')
  if (lines.length <= 1) return lines[0] ?? ''
  return lines.map((line, i) => (i === 0 ? line : `${indent}${line}`)).join('\n')
}

/**
 * Render a manifest codegen template against a fixed context.
 * Unknown tokens are replaced with `# UNRESOLVED:<token>` and recorded in `errors`.
 */
export function renderTemplate(template: string, ctx: RenderContext): RenderResult {
  const errors: string[] = []

  const code = template.replace(TOKEN, (_match, rawToken: string, offset: number) => {
    const token = rawToken.trim()

    switch (token) {
      case 'label':
        return escapePythonStrContent(ctx.label)
      case 'nodeName':
        return ctx.nodeName ?? ''
      case 'description':
        return escapePythonStrContent(ctx.description)
      case 'outputKey':
        return ctx.outputKey ?? ''
    }

    if (token.startsWith('field.')) {
      const rest = token.slice('field.'.length)
      const isRaw = rest.endsWith('.raw')
      const fieldId = isRaw ? rest.slice(0, -'.raw'.length) : rest
      const field = ctx.fields[fieldId]

      if (!field) {
        errors.push(`Unknown field: ${fieldId}`)
        return `# UNRESOLVED:${token}`
      }

      if (isRaw) {
        if (field.kind !== 'code') {
          errors.push(`.raw is only allowed on code fields: ${fieldId}`)
          return `# UNRESOLVED:${token}`
        }
        return reindentRaw(field.value as string, lineIndent(template, offset))
      }

      return escapeFieldValue(field, token, errors)
    }

    errors.push(`Unknown token: ${token}`)
    return `# UNRESOLVED:${token}`
  })

  return { code, errors }
}

/** Build a RenderContext from a placed custom node + its manifest. */
export function buildRenderContext(args: {
  nodeName: string
  label: string
  description: string
  outputKey: string
  configFields: { id: string; kind: ConfigFieldKind }[]
  config: Record<string, unknown>
}): RenderContext {
  const fields: Record<string, RenderField> = {}
  for (const f of args.configFields) {
    fields[f.id] = { kind: f.kind, value: args.config?.[f.id] }
  }
  return {
    nodeName: args.nodeName,
    label: args.label,
    description: args.description,
    outputKey: args.outputKey,
    fields,
  }
}
