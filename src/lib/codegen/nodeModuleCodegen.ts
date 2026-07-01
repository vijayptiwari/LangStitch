import type { Node } from '@xyflow/react'
import type { GraphDocument, StitchNodeData } from '../../types/graph'
import { slugify } from '../nodeRegistry'
import { getNodeCode } from '../nodeCode'

export const CUSTOM_REGION_BEGIN = '# region CUSTOM'
export const CUSTOM_REGION_END = '# endregion CUSTOM'

export function nodeMetadataHeader(node: Node<StitchNodeData>): string {
  const d = node.data
  return `# langstitch:node id=${node.id} kind=${d.kind} label=${JSON.stringify(d.label)}`
}

/**
 * Strip the common leading whitespace from a block (Python textwrap.dedent
 * equivalent) so the body can be safely re-indented to a single function level.
 * Without this, bodies that already carry indentation (e.g. the default
 * `    return {}` stub or user code) get double-indented and produce invalid
 * Python (`IndentationError: unexpected indent`).
 */
function dedent(code: string): string {
  const lines = code.replace(/\t/g, '    ').split('\n')
  let min = Infinity
  for (const line of lines) {
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    if (indent < min) min = indent
  }
  if (!Number.isFinite(min) || min === 0) return code
  return lines.map((line) => (line.trim() ? line.slice(min) : line)).join('\n')
}

export function formatNodeModule(
  _doc: GraphDocument,
  node: Node<StitchNodeData>,
  pkg: string,
): string {
  if (node.data.kind === 'start' || node.data.kind === 'end') return ''
  const fn = slugify(node.id)
  const body = dedent(getNodeCode(node.data)).trim() || 'return {}'
  const indentedBody = body
    .split('\n')
    .map((line) => (line.trim() ? `    ${line}` : ''))
    .join('\n')

  return `${nodeMetadataHeader(node)}
"""Node: ${node.data.label} (${node.data.kind})"""
from ${pkg}.state import State


def ${fn}(state: State) -> dict:
    """${node.data.description ?? node.data.label}"""
${CUSTOM_REGION_BEGIN}
${indentedBody}
${CUSTOM_REGION_END}
`
}

export function virtualNodePath(doc: GraphDocument, nodeId: string): string {
  const pkg = slugify(doc.name) || 'langstitch_graph'
  return `src/${pkg}/nodes/${slugify(nodeId)}.py`
}
