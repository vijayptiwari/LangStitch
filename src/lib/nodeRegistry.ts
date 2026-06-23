import type { NodeKind, StitchNodeData, PaletteItem } from '../types/graph'
import { MCP_TOOL_TEMPLATE } from './designerConstants'

export const nodeTypes: Record<NodeKind, string> = {
  start: 'startNode',
  end: 'endNode',
  llm: 'llmNode',
  tool: 'toolNode',
  router: 'routerNode',
  function: 'functionNode',
  subgraph: 'subgraphNode',
  agent: 'agentNode',
}

export const paletteItems: PaletteItem[] = [
  {
    kind: 'start',
    label: 'Entry Point',
    description: 'Graph entry — maps to START',
    icon: 'play',
    defaultData: { kind: 'start', label: 'Start' },
  },
  {
    kind: 'end',
    label: 'Exit Point',
    description: 'Graph termination — maps to END',
    icon: 'square',
    defaultData: { kind: 'end', label: 'End' },
  },
  {
    kind: 'llm',
    label: 'LLM Node',
    description: 'Language model call with prompts & bound tools/agents',
    icon: 'brain',
    defaultData: {
      kind: 'llm',
      label: 'LLM Agent',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'User message: {input}',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      outputKey: 'messages',
      boundToolIds: [],
      boundAgentIds: [],
    },
  },
  {
    kind: 'agent',
    label: 'Agent Node',
    description: 'Delegate to sub-agent, remote agent, or A2A agent',
    icon: 'bot',
    defaultData: {
      kind: 'agent',
      label: 'Sub Agent',
      connectionType: 'registry',
      agentRegistryId: '',
      subgraphId: '',
      remoteAgentId: '',
      a2aAgentId: '',
      inputMapping: '{}',
      outputMapping: '{}',
      delegateTools: true,
    },
  },
  {
    kind: 'tool',
    label: 'Tool Node',
    description: 'Execute tools — inline, registry, or MCP Studio',
    icon: 'wrench',
    defaultData: {
      kind: 'tool',
      label: 'Tool',
      connectionType: 'inline',
      toolRegistryId: '',
      mcpServerId: '',
      mcpToolName: '',
      toolName: 'search',
      toolDescription: 'Search the web',
      inputSchema: MCP_TOOL_TEMPLATE,
      inputKey: 'query',
      outputKey: 'tool_result',
    },
  },
  {
    kind: 'router',
    label: 'Decision Node',
    description: 'Conditional branching — add_conditional_edges',
    icon: 'git-branch',
    defaultData: {
      kind: 'router',
      label: 'Decision',
      routerFn: 'def route(state):\n    return "next"',
      branches: [
        { id: 'b1', label: 'next', condition: 'default' },
        { id: 'b2', label: 'fallback', condition: 'fallback' },
      ],
    },
  },
  {
    kind: 'function',
    label: 'Function Node',
    description: 'Custom Python transform or logic',
    icon: 'code',
    defaultData: {
      kind: 'function',
      label: 'Transform',
      functionName: 'process',
      code: 'def process(state):\n    return {"result": state.get("input", "")}',
      outputKey: 'result',
    },
  },
  {
    kind: 'subgraph',
    label: 'Subgraph Connector',
    description: 'Embed a nested StateGraph module',
    icon: 'layers',
    defaultData: {
      kind: 'subgraph',
      label: 'Subgraph',
      connectionType: 'local',
      subgraphId: '',
      remoteGraphId: '',
      remoteEndpoint: '',
      inputMapping: '{}',
      outputMapping: '{}',
    },
  },
]

export function createNodeData(kind: NodeKind, label?: string): StitchNodeData {
  const item = paletteItems.find((p) => p.kind === kind)
  if (!item) throw new Error(`Unknown node kind: ${kind}`)
  return { ...item.defaultData, label: label ?? item.defaultData.label ?? kind } as StitchNodeData
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'node'
}

export const DRAG_MIME = 'application/langstitch-node'
