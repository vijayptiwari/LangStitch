import type { A2aConfig, GraphSettings, LangfuseConfig, LangSmithConfig, LoggingConfig } from '../types/graph'

export const DEFAULT_LIFECYCLE = {
  onStartup: `# Called once when the graph runtime starts
def on_startup(context):
    """Initialize resources, warm caches, validate config."""
    pass
`,
  onShutdown: `# Called when the graph runtime shuts down
def on_shutdown(context):
    """Flush buffers, close connections, release resources."""
    pass
`,
}

export const DEFAULT_CHECKPOINTER = {
  manager: 'memory' as const,
  connectionString: 'postgresql://user:pass@localhost:5432/langgraph',
  tablePrefix: 'lg_',
  ttlSeconds: 86400,
}

export const DEFAULT_LANGSMITH: LangSmithConfig = {
  enabled: true,
  projectName: 'langstitch-graph',
  apiKeyEnv: 'LANGCHAIN_API_KEY',
  tracingV2: true,
}

export const DEFAULT_LANGFUSE: LangfuseConfig = {
  enabled: false,
  publicKeyEnv: 'LANGFUSE_PUBLIC_KEY',
  secretKeyEnv: 'LANGFUSE_SECRET_KEY',
  host: 'https://cloud.langfuse.com',
  release: '1.0.0',
}

export const DEFAULT_LOGGING: LoggingConfig = {
  enabled: true,
  level: 'info',
  format: 'json',
  logToFile: false,
  filePath: 'logs/langstitch.log',
  includeTraceId: true,
  includeNodeTiming: true,
}

export const DEFAULT_OBSERVABILITY = {
  enabled: true,
  provider: 'multi' as const,
  projectName: 'langstitch-graph',
  apiKeyEnv: 'LANGCHAIN_API_KEY',
  auditEvents: 'node_enter,node_exit,tool_call,agent_delegate,state_update,error',
  customEmitterCode: `# Custom audit event emitter
def emit_audit_event(event_type: str, payload: dict):
    """Emit structured audit events for compliance logging."""
    logger.info("audit_event", extra={"event_type": event_type, **payload})
`,
  langsmith: { ...DEFAULT_LANGSMITH },
  langfuse: { ...DEFAULT_LANGFUSE },
  logging: { ...DEFAULT_LOGGING },
}

export const DEFAULT_A2A: A2aConfig = {
  enabled: false,
  agentCardUrl: 'https://agents.example.com/.well-known/agent.json',
  skillId: 'default',
  authEnvVar: 'A2A_API_KEY',
  protocolVersion: '0.2',
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  checkpoint: 'memory',
  interruptBefore: '',
  maxSteps: 25,
  enableStreaming: true,
  tags: '',
  lifecycle: { ...DEFAULT_LIFECYCLE },
  checkpointer: { ...DEFAULT_CHECKPOINTER },
  observability: { ...DEFAULT_OBSERVABILITY },
  a2a: { ...DEFAULT_A2A },
}

export const AUDIT_EVENT_OPTIONS = [
  'node_enter',
  'node_exit',
  'tool_call',
  'agent_delegate',
  'mcp_call',
  'a2a_message',
  'state_update',
  'checkpoint_write',
  'human_interrupt',
  'error',
] as const

export const LLM_MODEL_PRESETS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
] as const

export const PROMPT_TEMPLATES = [
  {
    id: 'assistant',
    label: 'Helpful assistant',
    system: 'You are a helpful, accurate assistant. Be concise and cite uncertainty when unsure.',
    user: 'User message: {input}\n\nRespond helpfully.',
  },
  {
    id: 'agent',
    label: 'Tool-using agent',
    system: 'You are an agent that plans steps, calls tools when needed, and summarizes results.',
    user: 'Task: {input}\n\nAvailable context: {context}',
  },
  {
    id: 'router',
    label: 'Intent classifier',
    system: 'Classify the user intent. Reply with ONLY one label from the allowed set.',
    user: 'Message: {input}\n\nLabels: use_tool, direct, fallback',
  },
  {
    id: 'summarizer',
    label: 'Summarizer',
    system: 'Summarize the following content in 3 bullet points.',
    user: 'Content to summarize:\n{input}',
  },
] as const

export const ROUTER_TEMPLATES = [
  {
    id: 'simple',
    label: 'Simple if/else',
    code: `def route(state):
    """Return branch label matching add_conditional_edges map."""
    if state.get("use_tool"):
        return "use_tool"
    return "direct"`,
  },
  {
    id: 'messages',
    label: 'Last message keyword',
    code: `def route(state):
    messages = state.get("messages", [])
    if not messages:
        return "direct"
    text = str(messages[-1]).lower()
    if "search" in text or "tool" in text:
        return "use_tool"
    return "direct"`,
  },
] as const

export const MCP_TOOL_TEMPLATE = `{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Search query" }
  },
  "required": ["query"]
}`

export function mergeGraphSettings(partial?: Partial<GraphSettings>): GraphSettings {
  const obs = partial?.observability
  return {
    ...DEFAULT_GRAPH_SETTINGS,
    ...partial,
    lifecycle: { ...DEFAULT_LIFECYCLE, ...partial?.lifecycle },
    checkpointer: { ...DEFAULT_CHECKPOINTER, ...partial?.checkpointer },
    observability: {
      ...DEFAULT_OBSERVABILITY,
      ...obs,
      langsmith: { ...DEFAULT_LANGSMITH, ...obs?.langsmith },
      langfuse: { ...DEFAULT_LANGFUSE, ...obs?.langfuse },
      logging: { ...DEFAULT_LOGGING, ...obs?.logging },
    },
    a2a: { ...DEFAULT_A2A, ...partial?.a2a },
  }
}
