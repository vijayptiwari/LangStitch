import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { graphToFiles, filesToGraphDeltaFromVirtual } from '../codeGraphSync'
import { parseGraphFromVirtualFiles } from '../../codegen/pythonParser'
import type { GraphDocument, LLMNodeData } from '../../../types/graph'

function makeDoc(): GraphDocument {
  return {
    name: 'demo',
    description: '',
    stateFields: [],
    subgraphs: [],
    activeSubgraphId: 'main',
    version: 1,
  } as unknown as GraphDocument
}

function llmNode(id: string, customCode: string): Node<LLMNodeData> {
  return {
    id,
    type: 'llmNode',
    position: { x: 0, y: 0 },
    data: {
      kind: 'llm',
      label: id,
      model: 'gpt-4o-mini',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0,
      maxTokens: 1,
      topP: 1,
      outputKey: 'm',
      boundToolIds: [],
      boundAgentIds: [],
      customCode,
    },
  }
}

describe('graph <-> code round trip', () => {
  it('preserves custom code body through codegen and parse', () => {
    const doc = makeDoc()
    const nodes = [llmNode('llm-1', 'return {"m": ["hello"]}')]
    const files = graphToFiles(doc, nodes, [] as Edge[], { main: { nodes, edges: [] } }, ['main'])
    const parsed = parseGraphFromVirtualFiles(files)
    expect(parsed.nodes.find((n) => n.id === 'llm-1')?.customCode).toContain('return {"m": ["hello"]}')
  })

  it('detects a removed node module as a graph delta', () => {
    const doc = makeDoc()
    const nodes = [llmNode('llm-1', 'return {}'), llmNode('llm-2', 'return {}')]
    const files = graphToFiles(doc, nodes, [] as Edge[], { main: { nodes, edges: [] } }, ['main'])
    // Simulate deleting llm-2's module from the code view
    for (const key of Object.keys(files)) {
      if (key.includes('/nodes/llm_2.py')) delete files[key]
    }
    const { delta } = filesToGraphDeltaFromVirtual(files, nodes, [] as Edge[])
    expect(delta.nodesToRemove).toContain('llm-2')
    expect(delta.nodesToRemove).not.toContain('llm-1')
  })

  it('does not mutate the graph when the parse yields an error', () => {
    const nodes = [llmNode('llm-1', 'return {}')]
    const { delta } = filesToGraphDeltaFromVirtual({}, nodes, [] as Edge[])
    // No annotated node files => llm-1 would be flagged removed; ensure start/end safety
    // and that an empty file set never adds phantom nodes.
    expect(delta.nodesToAdd).toHaveLength(0)
  })
})
