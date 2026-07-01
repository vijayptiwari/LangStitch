import { describe, it, expect } from 'vitest'
import { getNodeCode, setNodeCode, hasCustomCode } from '../nodeCode'
import type { FunctionNodeData, LLMNodeData } from '../../types/graph'

describe('nodeCode', () => {
  it('reads function node code field', () => {
    const data: FunctionNodeData = {
      kind: 'function',
      label: 'Fn',
      functionName: 'fn',
      code: 'return {"x": 1}',
      outputKey: 'out',
    }
    expect(getNodeCode(data)).toBe('return {"x": 1}')
    expect(hasCustomCode(data)).toBe(true)
  })

  it('reads customCode on other kinds', () => {
    const data: LLMNodeData = {
      kind: 'llm',
      label: 'L',
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
    }
    expect(getNodeCode(data)).toBe('return {"m": []}')
  })

  it('setNodeCode writes to function.code', () => {
    const data: FunctionNodeData = {
      kind: 'function',
      label: 'Fn',
      functionName: 'fn',
      code: '',
      outputKey: 'out',
    }
    const next = setNodeCode(data, 'return {}') as FunctionNodeData
    expect(next.code).toBe('return {}')
  })

  it('default stub is not custom', () => {
    const data: LLMNodeData = {
      kind: 'llm',
      label: 'L',
      model: 'x',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0,
      maxTokens: 1,
      topP: 1,
      outputKey: 'm',
      boundToolIds: [],
      boundAgentIds: [],
    }
    expect(hasCustomCode(data)).toBe(false)
  })
})
