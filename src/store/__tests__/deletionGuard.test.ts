import { describe, it, expect } from 'vitest'
import { hasCustomCode } from '../../lib/nodeCode'
import type { LLMNodeData } from '../../types/graph'

describe('deletionGuard', () => {
  it('detects nodes with custom code', () => {
    const data: LLMNodeData = {
      kind: 'llm',
      label: 'X',
      model: 'm',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0,
      maxTokens: 1,
      topP: 1,
      outputKey: 'o',
      boundToolIds: [],
      boundAgentIds: [],
      customCode: 'return {"ok": True}',
    }
    expect(hasCustomCode(data)).toBe(true)
  })

  it('allows deletion of default stub nodes', () => {
    const data: LLMNodeData = {
      kind: 'llm',
      label: 'X',
      model: 'm',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0,
      maxTokens: 1,
      topP: 1,
      outputKey: 'o',
      boundToolIds: [],
      boundAgentIds: [],
    }
    expect(hasCustomCode(data)).toBe(false)
  })
})
