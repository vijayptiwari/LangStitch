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
  rag: 'ragNode',
  intent_classifier: 'intentClassifierNode',
  hitl: 'hitlNode',
  response_transformer: 'responseTransformerNode',
  custom: 'customNode',
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
  {
    kind: 'rag',
    label: 'RAG Agent',
    description: 'Retrieval-augmented generation — chunk, embed, vector/vectorless/hybrid',
    icon: 'database',
    defaultData: {
      kind: 'rag',
      label: 'RAG Agent',
      pipelineId: 'rag_default',
      queryKey: 'query',
      outputKey: 'rag_context',
      personaId: '',
      skillIds: [],
      guardrailIds: [],
      includeSources: true,
    },
  },
  {
    kind: 'intent_classifier',
    label: 'Multi-Intent Classifier',
    description: 'Special decision node — classify into multiple intents and route',
    icon: 'git-branch',
    defaultData: {
      kind: 'intent_classifier',
      label: 'Intent Classifier',
      model: 'gpt-4o-mini',
      systemPrompt: 'Classify the user message into one or more intent labels from the allowed set.',
      confidenceThreshold: 0.7,
      fallbackIntent: 'fallback',
      multiIntent: true,
      classifierFn: `def classify_intents(state):
    """Return primary intent label (or comma-separated for multi-intent)."""
    messages = state.get("messages", [])
    if not messages:
        return "fallback"
    text = str(messages[-1]).lower()
    if "help" in text:
        return "support"
    if "buy" in text or "order" in text:
        return "sales"
    return "fallback"`,
      intents: [
        { id: 'i1', label: 'support', description: 'Help and support requests', examples: 'help, issue, problem' },
        { id: 'i2', label: 'sales', description: 'Sales and purchasing', examples: 'buy, price, order' },
        { id: 'i3', label: 'fallback', description: 'Default route', examples: '' },
      ],
    },
  },
  {
    kind: 'hitl',
    label: 'Human-in-the-Loop',
    description: 'Pause for human approval, edit, or input — maps to interrupt()',
    icon: 'user-check',
    defaultData: {
      kind: 'hitl',
      label: 'Human Review',
      interactionType: 'approval',
      promptMessage: 'Please review and approve before continuing.',
      outputKey: 'human_decision',
      approveLabel: 'Approve',
      rejectLabel: 'Reject',
      allowEdit: false,
      timeoutSeconds: 0,
    },
  },
  {
    kind: 'response_transformer',
    label: 'Response Transformer',
    description: 'Reshape / format the response — template, expression, or Python',
    icon: 'wand',
    defaultData: {
      kind: 'response_transformer',
      label: 'Response Transformer',
      transformType: 'template',
      template: '{messages}',
      expression: "state.get('messages', [])[-1]",
      code: 'def transform(state):\n    return {"response": state.get("messages", "")}',
      inputKey: 'messages',
      outputKey: 'response',
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
