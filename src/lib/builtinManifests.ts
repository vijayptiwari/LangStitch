import type { ComponentManifest } from '../types/component'

/**
 * Built-in component manifests — the Component Designer "big-bang" foundation.
 *
 * Every former hard-coded node kind (start, end, llm, agent, tool, router,
 * function, subgraph, rag, intent_classifier) plus two new primitives
 * (human_interrupt, scope) is expressed as a data-only {@link ComponentManifest}.
 * Codegen templates emit `langstitch` SDK code through the safe template engine
 * (NFR-4: pure string substitution, no eval).
 *
 * These manifests are flagged `builtin: true` and are merged into every
 * project's `componentRegistry` on load (see `getBuiltinRegistry`). They are
 * not user-removable.
 */

const SCHEMA = '1.0' as const

/** start — graph entry point. */
const startManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'start',
  label: 'Start',
  category: 'node',
  description: 'Graph entry point. Seeds the initial state.',
  builtin: true,
  version: '0.1.0',
  ports: [{ id: 'out', label: 'Out', side: 'right', multiplicity: 'single' }],
  configFields: [],
  theme: { color: '#34d399', colorLight: '#6ee7b7', icon: 'zap', typeLabel: 'Entry' },
  codegen: {
    kind: 'node',
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    # Entry point — pass initial state through unchanged.
    return {}
`,
  },
}

/** end — terminal node. */
const endManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'end',
  label: 'End',
  category: 'node',
  description: 'Terminal node. Finalizes the graph run.',
  builtin: true,
  version: '0.1.0',
  ports: [{ id: 'in', label: 'In', side: 'left', multiplicity: 'multi' }],
  configFields: [],
  theme: { color: '#fb7185', colorLight: '#fda4af', icon: 'box', typeLabel: 'Exit' },
  codegen: {
    kind: 'terminal',
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    # Terminal node — no further state mutation.
    return {}
`,
  },
}

/** llm — chat model invocation with optional bound tools. */
const llmManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'llm',
  label: 'LLM',
  category: 'node',
  description: 'Invoke a chat model with a system prompt and optional bound tools.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    {
      id: 'model',
      label: 'Model',
      kind: 'select',
      defaultValue: 'gpt-4o-mini',
      options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
        { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      ],
    },
    {
      id: 'system_prompt',
      label: 'System Prompt',
      kind: 'code',
      language: 'text',
      defaultValue: 'You are a helpful assistant.',
    },
    { id: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 2, defaultValue: 0.7 },
    { id: 'max_tokens', label: 'Max Tokens', kind: 'number', min: 1, defaultValue: 1024 },
    { id: 'tools', label: 'Bound Tools', kind: 'multiref', source: 'tools' },
    { id: 'output_key', label: 'Output Key', kind: 'string', defaultValue: 'messages' },
  ],
  theme: { color: '#a78bfa', colorLight: '#c4b5fd', icon: 'brain', typeLabel: 'LLM' },
  codegen: {
    kind: 'node',
    imports: ['from langstitch import ChatModel, system_message'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    llm = ChatModel(model={{field.model}}, temperature={{field.temperature}}, max_tokens={{field.max_tokens}})
    tool_ids = {{field.tools}}
    if tool_ids:
        llm = llm.bind_tools(tool_ids)
    messages = [system_message({{field.system_prompt}})] + state.get("messages", [])
    response = llm.invoke(messages)
    return { {{field.output_key}}: [response] }
`,
  },
}

/** agent — delegate to a registered agent with skills + persona. */
const agentManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'agent',
  label: 'Agent',
  category: 'node',
  description: 'Delegate the turn to a registered agent with skills and a persona.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'agent_ref', label: 'Agent', kind: 'ref', source: 'agents', required: true },
    { id: 'persona', label: 'Persona', kind: 'ref', source: 'personas' },
    { id: 'skills', label: 'Skills', kind: 'multiref', source: 'skills' },
    { id: 'output_key', label: 'Output Key', kind: 'string', defaultValue: 'messages' },
  ],
  theme: { color: '#2dd4bf', colorLight: '#5eead4', icon: 'bot', typeLabel: 'Agent' },
  codegen: {
    kind: 'agent',
    imports: ['from langstitch import build_agent'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    agent = build_agent(
        agent_id={{field.agent_ref}},
        persona={{field.persona}},
        skills={{field.skills}},
    )
    result = agent.invoke(state)
    return { {{field.output_key}}: result }
`,
  },
}

/** tool — invoke a registered tool. */
const toolManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'tool',
  label: 'Tool',
  category: 'node',
  description: 'Invoke a registered tool with an input key from state.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'tool_ref', label: 'Tool', kind: 'ref', source: 'tools', required: true },
    { id: 'input_key', label: 'Input Key', kind: 'string', defaultValue: 'query' },
    { id: 'output_key', label: 'Output Key', kind: 'string', defaultValue: 'tool_result' },
  ],
  theme: { color: '#fbbf24', colorLight: '#fcd34d', icon: 'wrench', typeLabel: 'Tool' },
  codegen: {
    kind: 'node',
    imports: ['from langstitch import resolve_tool'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    tool = resolve_tool({{field.tool_ref}})
    tool_input = state.get({{field.input_key}})
    result = tool.invoke(tool_input)
    return { {{field.output_key}}: result }
`,
  },
}

/** router — conditional branch dispatch (drives dynamic output ports). */
const routerManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'router',
  label: 'Router',
  category: 'node',
  description: 'Route to one of several branches based on a condition.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'multi' },
  ],
  configFields: [
    {
      id: 'routes',
      label: 'Routes',
      kind: 'list',
      portLabelField: 'label',
      fields: [
        { id: 'label', label: 'Label', kind: 'string', required: true },
        { id: 'condition', label: 'Condition', kind: 'string' },
      ],
    },
    { id: 'default_route', label: 'Default Route', kind: 'string', defaultValue: 'end' },
  ],
  theme: { color: '#38bdf8', colorLight: '#7dd3fc', icon: 'git-branch', typeLabel: 'Decision' },
  codegen: {
    kind: 'router',
    imports: ['from langstitch import evaluate_routes'],
    template: `def {{nodeName}}(state: State) -> str:
    """{{description}}"""
    routes = {{field.routes}}
    return evaluate_routes(state, routes, default={{field.default_route}})
`,
  },
}

/** function — inline Python node body. */
const functionManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'function',
  label: 'Function',
  category: 'node',
  description: 'Run an inline Python function over the graph state.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'output_key', label: 'Output Key', kind: 'string', defaultValue: 'result' },
    {
      id: 'body',
      label: 'Body',
      kind: 'code',
      language: 'python',
      defaultValue: 'value = state.get("messages", [])',
    },
  ],
  theme: { color: '#94a3b8', colorLight: '#cbd5e1', icon: 'code', typeLabel: 'Function' },
  codegen: {
    kind: 'node',
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    {{field.body.raw}}
    return { {{field.output_key}}: value }
`,
  },
}

/** subgraph — invoke a compiled subgraph with input/output mappings. */
const subgraphManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'subgraph',
  label: 'Subgraph',
  category: 'node',
  description: 'Invoke a nested compiled subgraph with explicit IO mappings.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'subgraph_ref', label: 'Subgraph', kind: 'ref', source: 'subgraphs', required: true },
    { id: 'input_mapping', label: 'Input Mapping', kind: 'json', defaultValue: '{}' },
    { id: 'output_mapping', label: 'Output Mapping', kind: 'json', defaultValue: '{}' },
  ],
  theme: { color: '#f472b6', colorLight: '#f9a8d4', icon: 'layers', typeLabel: 'Subgraph' },
  codegen: {
    kind: 'subgraph',
    imports: ['from langstitch import resolve_subgraph'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    subgraph = resolve_subgraph({{field.subgraph_ref}})
    input_map = {{field.input_mapping}}
    output_map = {{field.output_mapping}}
    sub_input = {target: state.get(src) for target, src in input_map.items()}
    sub_result = subgraph.invoke(sub_input)
    return {out_key: sub_result.get(src) for out_key, src in output_map.items()}
`,
  },
}

/** rag — retrieval-augmented generation pipeline call. */
const ragManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'rag',
  label: 'RAG',
  category: 'node',
  description: 'Retrieve context from a configured RAG pipeline.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'pipeline_ref', label: 'Pipeline', kind: 'ref', source: 'pipelines', required: true },
    { id: 'query_key', label: 'Query Key', kind: 'string', defaultValue: 'query' },
    { id: 'top_k', label: 'Top K', kind: 'number', min: 1, defaultValue: 5 },
    { id: 'output_key', label: 'Output Key', kind: 'string', defaultValue: 'context' },
  ],
  theme: { color: '#818cf8', colorLight: '#a5b4fc', icon: 'database', typeLabel: 'RAG' },
  codegen: {
    kind: 'node',
    imports: ['from langstitch import resolve_pipeline'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    pipeline = resolve_pipeline({{field.pipeline_ref}})
    query = state.get({{field.query_key}})
    docs = pipeline.retrieve(query, top_k={{field.top_k}})
    return { {{field.output_key}}: docs }
`,
  },
}

/** intent_classifier — classify into branches (drives dynamic output ports). */
const intentClassifierManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'intent_classifier',
  label: 'Intent Classifier',
  category: 'node',
  description: 'Classify the input into one of several intents and route accordingly.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'multi' },
  ],
  configFields: [
    {
      id: 'model',
      label: 'Model',
      kind: 'select',
      defaultValue: 'gpt-4o-mini',
      options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
      ],
    },
    {
      id: 'intents',
      label: 'Intents',
      kind: 'list',
      portLabelField: 'label',
      fields: [
        { id: 'label', label: 'Label', kind: 'string', required: true },
        { id: 'description', label: 'Description', kind: 'string' },
        { id: 'examples', label: 'Examples', kind: 'string' },
      ],
    },
    { id: 'confidence_threshold', label: 'Confidence Threshold', kind: 'number', min: 0, max: 1, defaultValue: 0.5 },
    { id: 'fallback_intent', label: 'Fallback Intent', kind: 'string', defaultValue: 'unknown' },
  ],
  theme: { color: '#e879f9', colorLight: '#f0abfc', icon: 'git-branch', typeLabel: 'Intents' },
  codegen: {
    kind: 'router',
    imports: ['from langstitch import classify_intent'],
    template: `def {{nodeName}}(state: State) -> str:
    """{{description}}"""
    intents = {{field.intents}}
    return classify_intent(
        state,
        model={{field.model}},
        intents=intents,
        threshold={{field.confidence_threshold}},
        fallback={{field.fallback_intent}},
    )
`,
  },
}

/** human_interrupt — pause for human input (LangGraph interrupt). */
const humanInterruptManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'human_interrupt',
  label: 'Human Interrupt',
  category: 'node',
  description: 'Pause the graph and wait for human input before resuming.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'prompt', label: 'Prompt', kind: 'string', defaultValue: 'Awaiting human review' },
    { id: 'resume_key', label: 'Resume Key', kind: 'string', defaultValue: 'human_input' },
  ],
  theme: { color: '#f59e0b', colorLight: '#fbbf24', icon: 'zap', typeLabel: 'Interrupt' },
  codegen: {
    kind: 'human_interrupt',
    imports: ['from langgraph.types import interrupt'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    human_value = interrupt({{field.prompt}})
    return { {{field.resume_key}}: human_value }
`,
  },
}

/** scope — guarded namespace wrapper around downstream nodes. */
const scopeManifest: ComponentManifest = {
  schemaVersion: SCHEMA,
  id: 'scope',
  label: 'Scope',
  category: 'node',
  description: 'A guarded scope that applies guardrails to the enclosed flow.',
  builtin: true,
  version: '0.1.0',
  ports: [
    { id: 'in', label: 'In', side: 'left', multiplicity: 'multi' },
    { id: 'out', label: 'Out', side: 'right', multiplicity: 'single' },
  ],
  configFields: [
    { id: 'scope_name', label: 'Scope Name', kind: 'string', defaultValue: 'scope' },
    { id: 'guardrails', label: 'Guardrails', kind: 'multiref', source: 'guardrails' },
  ],
  theme: { color: '#c084fc', colorLight: '#d8b4fe', icon: 'puzzle', typeLabel: 'Scope' },
  codegen: {
    kind: 'scope',
    imports: ['from langstitch import apply_guardrails'],
    template: `def {{nodeName}}(state: State) -> dict:
    """{{description}}"""
    guarded = apply_guardrails(state, guardrail_ids={{field.guardrails}}, scope={{field.scope_name}})
    return guarded
`,
  },
}

/** Ordered list of all built-in manifests (palette display order). */
export const BUILTIN_MANIFESTS: ComponentManifest[] = [
  startManifest,
  endManifest,
  llmManifest,
  agentManifest,
  toolManifest,
  routerManifest,
  functionManifest,
  subgraphManifest,
  ragManifest,
  intentClassifierManifest,
  humanInterruptManifest,
  scopeManifest,
]

/** Set of built-in component ids for fast membership checks. */
export const BUILTIN_IDS: ReadonlySet<string> = new Set(BUILTIN_MANIFESTS.map((m) => m.id))

/** True when a component id refers to a built-in (non-removable) manifest. */
export function isBuiltinComponent(componentId: string): boolean {
  return BUILTIN_IDS.has(componentId)
}
