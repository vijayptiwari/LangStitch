export type NodeKind =
  | 'start'
  | 'end'
  | 'llm'
  | 'tool'
  | 'router'
  | 'function'
  | 'subgraph'
  | 'agent'

export type StateFieldType = 'str' | 'int' | 'float' | 'bool' | 'list' | 'dict' | 'messages'

export interface StateField {
  id: string
  name: string
  type: StateFieldType
  reducer?: 'append' | 'replace'
  defaultValue?: string
}

export interface RouterBranch {
  id: string
  label: string
  condition: string
  targetNodeId?: string
}

export interface BaseNodeData extends Record<string, unknown> {
  label: string
  description?: string
}

export interface LLMNodeData extends BaseNodeData {
  kind: 'llm'
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  outputKey: string
  boundToolIds: string[]
  boundAgentIds: string[]
}

export type ToolConnectionType = 'inline' | 'registry' | 'mcp'

export interface ToolNodeData extends BaseNodeData {
  kind: 'tool'
  connectionType: ToolConnectionType
  toolRegistryId: string
  mcpServerId: string
  mcpToolName: string
  toolName: string
  toolDescription: string
  inputSchema: string
  inputKey: string
  outputKey: string
}

export interface RouterNodeData extends BaseNodeData {
  kind: 'router'
  routerFn: string
  branches: RouterBranch[]
}

export interface FunctionNodeData extends BaseNodeData {
  kind: 'function'
  functionName: string
  code: string
  outputKey: string
}

export type SubgraphConnectionType = 'local' | 'remote'

export interface SubgraphNodeData extends BaseNodeData {
  kind: 'subgraph'
  connectionType: SubgraphConnectionType
  subgraphId: string
  remoteGraphId: string
  remoteEndpoint: string
  inputMapping: string
  outputMapping: string
}

export type AgentConnectionType = 'subagent' | 'remote' | 'a2a' | 'registry'

export interface AgentNodeData extends BaseNodeData {
  kind: 'agent'
  connectionType: AgentConnectionType
  agentRegistryId: string
  subgraphId: string
  remoteAgentId: string
  a2aAgentId: string
  inputMapping: string
  outputMapping: string
  delegateTools: boolean
}

export interface StartNodeData extends BaseNodeData {
  kind: 'start'
}

export interface EndNodeData extends BaseNodeData {
  kind: 'end'
}

export type StitchNodeData =
  | StartNodeData
  | EndNodeData
  | LLMNodeData
  | ToolNodeData
  | RouterNodeData
  | FunctionNodeData
  | SubgraphNodeData
  | AgentNodeData

export interface LifecycleHooks {
  onStartup: string
  onShutdown: string
}

export interface CheckpointerConfig {
  manager: 'none' | 'memory' | 'postgres' | 'sqlite' | 'redis'
  connectionString: string
  tablePrefix: string
  ttlSeconds: number
}

export interface LangSmithConfig {
  enabled: boolean
  projectName: string
  apiKeyEnv: string
  tracingV2: boolean
}

export interface LangfuseConfig {
  enabled: boolean
  publicKeyEnv: string
  secretKeyEnv: string
  host: string
  release: string
}

export interface LoggingConfig {
  enabled: boolean
  level: 'debug' | 'info' | 'warning' | 'error'
  format: 'text' | 'json'
  logToFile: boolean
  filePath: string
  includeTraceId: boolean
  includeNodeTiming: boolean
}

export interface ObservabilityConfig {
  enabled: boolean
  provider: 'langsmith' | 'langfuse' | 'opentelemetry' | 'custom' | 'multi'
  projectName: string
  apiKeyEnv: string
  auditEvents: string
  customEmitterCode: string
  langsmith: LangSmithConfig
  langfuse: LangfuseConfig
  logging: LoggingConfig
}

export interface A2aConfig {
  enabled: boolean
  agentCardUrl: string
  skillId: string
  authEnvVar: string
  protocolVersion: string
}

export interface GraphSettings {
  checkpoint: 'none' | 'memory' | 'postgres'
  interruptBefore: string
  maxSteps: number
  enableStreaming: boolean
  tags: string
  lifecycle: LifecycleHooks
  checkpointer: CheckpointerConfig
  observability: ObservabilityConfig
  a2a: A2aConfig
}

export interface RemoteGraphRef {
  id: string
  name: string
  url: string
  description?: string
  authEnvVar: string
  version: string
}

export type ToolSourceType = 'builtin' | 'mcp' | 'python' | 'http' | 'langchain'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  source: ToolSourceType
  mcpServerId: string
  mcpToolName: string
  inputSchema: string
  pythonCode: string
  httpEndpoint: string
  tags: string
}

export type AgentKind = 'subagent' | 'remote' | 'a2a' | 'supervisor'

export interface AgentDefinition {
  id: string
  name: string
  description: string
  kind: AgentKind
  subgraphId: string
  remoteUrl: string
  a2aAgentCardUrl: string
  model: string
  systemPrompt: string
  toolIds: string[]
  authEnvVar: string
}

export type McpTransport = 'stdio' | 'sse' | 'streamable-http'

export interface McpToolDef {
  id: string
  name: string
  description: string
  inputSchema: string
}

export interface McpResourceDef {
  id: string
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface McpServerDefinition {
  id: string
  name: string
  transport: McpTransport
  command: string
  args: string
  url: string
  envVars: string
  tools: McpToolDef[]
  resources: McpResourceDef[]
}

export interface SubgraphDefinition {
  id: string
  name: string
  parentId: string | null
  stateFields: StateField[]
  nodeIds: string[]
  edgeIds: string[]
}

export interface GraphDocument {
  version: '1.0'
  name: string
  description?: string
  stateFields: StateField[]
  subgraphs: SubgraphDefinition[]
  activeSubgraphId: string
  settings: GraphSettings
  remoteGraphs: RemoteGraphRef[]
  toolRegistry: ToolDefinition[]
  agentRegistry: AgentDefinition[]
  mcpServers: McpServerDefinition[]
}

export interface CanvasSnapshot {
  nodes: import('@xyflow/react').Node<StitchNodeData>[]
  edges: import('@xyflow/react').Edge[]
}

export interface PaletteItem {
  kind: NodeKind
  label: string
  description: string
  icon: string
  defaultData: Partial<StitchNodeData>
}
