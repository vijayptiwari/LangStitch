import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { formatNodeModule, CUSTOM_REGION_BEGIN } from '../nodeModuleCodegen'
import type { GraphDocument, LLMNodeData } from '../../../types/graph'

describe('nodeModuleCodegen', () => {
  it('injects customCode inside CUSTOM region', () => {
    const doc = {
      name: 'demo',
      description: '',
      stateFields: [],
      subgraphs: [],
      activeSubgraphId: 'main',
    } as unknown as GraphDocument

    const node: Node<LLMNodeData> = {
      id: 'llm-1',
      type: 'llmNode',
      position: { x: 0, y: 0 },
      data: {
        kind: 'llm',
        label: 'Assistant',
        model: 'gpt-4o-mini',
        systemPrompt: 'hi',
        userPrompt: '{input}',
        temperature: 0.7,
        maxTokens: 100,
        topP: 1,
        outputKey: 'messages',
        boundToolIds: [],
        boundAgentIds: [],
        customCode: 'return {"messages": []}',
      },
    }

    const mod = formatNodeModule(doc, node, 'demo')
    expect(mod).toContain('# langstitch:node id=llm-1')
    expect(mod).toContain(CUSTOM_REGION_BEGIN)
    expect(mod).toContain('return {"messages": []}')
  })
})
