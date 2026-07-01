import { describe, it, expect } from 'vitest'
import { graphToFiles } from '../codeGraphSync'
import type { GraphDocument } from '../../../types/graph'
import type { Node, Edge } from '@xyflow/react'
import type { LLMNodeData } from '../../../types/graph'

describe('codeGraphSync', () => {
  it('graphToFiles emits node modules with CUSTOM markers', () => {
    const doc = {
      name: 'demo',
      description: '',
      stateFields: [],
      subgraphs: [],
      activeSubgraphId: 'main',
      version: 1,
    } as unknown as GraphDocument

    const nodes: Node<LLMNodeData>[] = [
      {
        id: 'llm-1',
        type: 'llmNode',
        position: { x: 0, y: 0 },
        data: {
          kind: 'llm',
          label: 'Bot',
          model: 'gpt-4o-mini',
          systemPrompt: '',
          userPrompt: '',
          temperature: 0,
          maxTokens: 1,
          topP: 1,
          outputKey: 'm',
          boundToolIds: [],
          boundAgentIds: [],
          customCode: 'return {"m": []}',
        },
      },
    ]
    const files = graphToFiles(doc, nodes, [] as Edge[], { main: { nodes, edges: [] } }, ['main'])
    const nodeFile = Object.entries(files).find(([p]) => p.includes('/nodes/llm_1.py'))
    expect(nodeFile).toBeDefined()
    expect(nodeFile![1]).toContain('# region CUSTOM')
    expect(nodeFile![1]).toContain('return {"m": []}')
  })
})
