import type { Node } from '@xyflow/react'
import type { CanvasSnapshot, CustomNodeData, StitchNodeData } from '../types/graph'
import type { ComponentManifest, ConfigField } from '../types/component'
import { BUILTIN_MANIFESTS } from './builtinManifests'

/**
 * Node data migration for the Component Designer "big-bang" foundation.
 *
 * Legacy graphs stored a distinct, hand-coded data shape per node kind
 * (`LLMNodeData`, `ToolNodeData`, …). The unified model expresses every node as
 * a manifest-driven {@link CustomNodeData} `{ kind: 'custom', componentId, config }`.
 *
 * This module converts the legacy "body" kinds (llm, tool, router, function,
 * subgraph, agent, rag, intent_classifier) onto their matching built-in
 * manifests. `start` and `end` are intentionally left untouched: they are
 * structural graph anchors that the graph builder/codegen detect by `kind`, so
 * converting them here would break START/END wiring. Already-`custom` nodes are
 * returned unchanged (idempotent).
 */

const BUILTIN_BY_ID = new Map(BUILTIN_MANIFESTS.map((m) => [m.id, m]))

/** React Flow node type for manifest-driven custom nodes (see `nodeRegistry`). */
const CUSTOM_NODE_TYPE = 'customNode'

/** Legacy kinds with a 1:1 built-in manifest that migrate to `custom`. */
const MIGRATABLE_KINDS: ReadonlySet<StitchNodeData['kind']> = new Set([
  'llm',
  'tool',
  'router',
  'function',
  'subgraph',
  'agent',
  'rag',
  'intent_classifier',
])

/** Resolve a config field's default runtime value (mirrors customComponents, no UI deps). */
function fieldDefault(field: ConfigField): unknown {
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
    default:
      return ''
  }
}

function manifestDefaults(manifest: ComponentManifest): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const f of manifest.configFields) config[f.id] = fieldDefault(f)
  return config
}

/** Map a legacy node's per-kind fields onto its built-in manifest config ids. */
function legacyToConfig(data: StitchNodeData): Record<string, unknown> {
  switch (data.kind) {
    case 'llm':
      return {
        model: data.model,
        system_prompt: data.systemPrompt,
        temperature: data.temperature,
        max_tokens: data.maxTokens,
        tools: data.boundToolIds ?? [],
        output_key: data.outputKey,
      }
    case 'tool':
      return {
        tool_ref: data.toolRegistryId,
        input_key: data.inputKey,
        output_key: data.outputKey,
      }
    case 'router':
      return {
        routes: (data.branches ?? []).map((b) => ({ label: b.label, condition: b.condition })),
        default_route: 'end',
      }
    case 'function':
      return {
        output_key: data.outputKey,
        body: data.code,
      }
    case 'subgraph':
      return {
        subgraph_ref: data.subgraphId,
        input_mapping: data.inputMapping,
        output_mapping: data.outputMapping,
      }
    case 'agent':
      return {
        agent_ref: data.agentRegistryId,
        persona: '',
        skills: [],
        output_key: 'messages',
      }
    case 'rag':
      return {
        pipeline_ref: data.pipelineId,
        query_key: data.queryKey,
        top_k: 5,
        output_key: data.outputKey,
      }
    case 'intent_classifier':
      return {
        model: data.model,
        intents: (data.intents ?? []).map((i) => ({
          label: i.label,
          description: i.description,
          examples: i.examples,
        })),
        confidence_threshold: data.confidenceThreshold,
        fallback_intent: data.fallbackIntent,
      }
    default:
      return {}
  }
}

/** True when this node data is a legacy body kind that should be migrated. */
export function needsNodeMigration(data: StitchNodeData): boolean {
  return MIGRATABLE_KINDS.has(data.kind)
}

/**
 * Convert legacy per-kind node data to the unified `{ kind: 'custom', … }` shape.
 * Idempotent: `custom`, `start`, and `end` data is returned unchanged.
 */
export function migrateNodeData(data: StitchNodeData): StitchNodeData {
  if (!needsNodeMigration(data)) return data

  const componentId = data.kind
  const manifest = BUILTIN_BY_ID.get(componentId)
  const config: Record<string, unknown> = manifest ? manifestDefaults(manifest) : {}

  for (const [key, value] of Object.entries(legacyToConfig(data))) {
    if (value !== undefined) config[key] = value
  }

  const legacyCode =
    data.kind === 'function'
      ? (data as { code?: string }).code
      : (data as { customCode?: string }).customCode

  const migrated: CustomNodeData = {
    kind: 'custom',
    label: data.label,
    description: data.description,
    componentId,
    config,
    outputKey: (data as { outputKey?: string }).outputKey,
    ...(legacyCode?.trim() ? { customCode: legacyCode } : {}),
  }
  return migrated
}

/** Migrate a single React Flow node, updating both its `type` and `data`. */
export function migrateNode<T extends Node<StitchNodeData>>(node: T): T {
  if (!needsNodeMigration(node.data)) return node
  return { ...node, type: CUSTOM_NODE_TYPE, data: migrateNodeData(node.data) }
}

/** Migrate every node in a flat node list. */
export function migrateNodes(nodes: Node<StitchNodeData>[]): Node<StitchNodeData>[] {
  return nodes.map((n) => migrateNode(n))
}

/** Migrate all canvases in a `canvasByGraph` map (nodes only; edges are untouched). */
export function migrateCanvases(
  canvasByGraph: Record<string, CanvasSnapshot>,
): Record<string, CanvasSnapshot> {
  const out: Record<string, CanvasSnapshot> = {}
  for (const [graphId, snapshot] of Object.entries(canvasByGraph)) {
    out[graphId] = { ...snapshot, nodes: migrateNodes(snapshot.nodes) }
  }
  return out
}

/**
 * Load-time adapter used by the graph store. Migrates whichever node containers
 * the project payload provides (the multi-canvas map and/or a flat active-canvas
 * list), tolerating `undefined` for either. Returns only the inputs that were
 * present so callers can fall back to their originals.
 */
export function migrateProjectNodes(
  canvasByGraph: Record<string, CanvasSnapshot> | undefined,
  nodes: Node<StitchNodeData>[] | undefined,
): {
  canvasByGraph?: Record<string, CanvasSnapshot>
  nodes?: Node<StitchNodeData>[]
} {
  return {
    canvasByGraph: canvasByGraph ? migrateCanvases(canvasByGraph) : undefined,
    nodes: nodes ? migrateNodes(nodes) : undefined,
  }
}
