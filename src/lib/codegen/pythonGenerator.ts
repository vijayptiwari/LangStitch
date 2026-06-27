import type { Edge, Node } from '@xyflow/react'
import type {
  AgentDefinition,
  CanvasSnapshot,
  GraphDocument,
  StitchNodeData,
  McpServerDefinition,
  RemoteGraphRef,
  RouterBranch,
  StateField,
  SubgraphDefinition,
  ToolDefinition,
} from '../../types/graph'
import type { ComponentManifest } from '../../types/component'
import { slugify } from '../nodeRegistry'
import { DEFAULT_GRAPH_SETTINGS, mergeGraphSettings } from '../designerConstants'
import { MAIN_GRAPH_ID } from '../subgraphCanvas'
import { buildRenderContext, renderTemplate } from './templateEngine'
import { BUILTIN_MANIFESTS } from '../builtinManifests'

function stateFieldToPython(field: StateField): string {
  const typeMap: Record<StateField['type'], string> = {
    str: 'str',
    int: 'int',
    float: 'float',
    bool: 'bool',
    list: 'list',
    dict: 'dict',
    messages: 'Annotated[list, add_messages]',
  }

  if (field.type === 'messages') {
    return `    ${field.name}: ${typeMap[field.type]}`
  }
  return `    ${field.name}: ${typeMap[field.type]}`
}

function generateStateClass(stateFields: StateField[]): string {
  const needsMessages = stateFields.some((f) => f.type === 'messages')
  const imports = needsMessages
    ? 'from typing import Annotated, TypedDict\nfrom langgraph.graph.message import add_messages'
    : 'from typing import TypedDict'

  const fields =
    stateFields.length > 0
      ? stateFields.map(stateFieldToPython).join('\n')
      : '    messages: Annotated[list, add_messages]'

  if (stateFields.length === 0 && !needsMessages) {
    return `${imports}\n\n\nclass State(TypedDict):\n    messages: Annotated[list, add_messages]`
  }

  return `${imports}\n\n\nclass State(TypedDict):\n${fields}`
}

function generateLifecycleHooks(doc: GraphDocument): string {
  const lifecycle = doc.settings?.lifecycle
  if (!lifecycle?.onStartup && !lifecycle?.onShutdown) return ''
  return `${lifecycle.onStartup ?? ''}\n\n${lifecycle.onShutdown ?? ''}\n`
}

function generateCheckpointerSetup(doc: GraphDocument): string {
  const cp = doc.settings?.checkpointer
  if (!cp || cp.manager === 'none') return '# No checkpointer configured\n'

  const lines: string[] = ['# Checkpointer manager configuration']
  switch (cp.manager) {
    case 'memory':
      lines.push('from langgraph.checkpoint.memory import MemorySaver')
      lines.push('checkpointer = MemorySaver()')
      break
    case 'postgres':
      lines.push('from langgraph.checkpoint.postgres import PostgresSaver')
      lines.push(`# connection: ${cp.connectionString}`)
      lines.push(`# table_prefix: ${cp.tablePrefix}, ttl: ${cp.ttlSeconds}s`)
      lines.push('checkpointer = PostgresSaver.from_conn_string(os.environ["DATABASE_URL"])')
      break
    case 'sqlite':
      lines.push('from langgraph.checkpoint.sqlite import SqliteSaver')
      lines.push(`# ttl: ${cp.ttlSeconds}s`)
      lines.push('checkpointer = SqliteSaver.from_conn_string("checkpoints.db")')
      break
    case 'redis':
      lines.push('# Redis checkpointer — configure via langgraph-checkpoint-redis')
      lines.push(`# connection: ${cp.connectionString}, prefix: ${cp.tablePrefix}`)
      lines.push('checkpointer = None  # TODO: wire RedisSaver')
      break
    default:
      lines.push('checkpointer = None')
  }
  return lines.join('\n') + '\n'
}

function generateLoggingSetup(doc: GraphDocument): string {
  const log = doc.settings?.observability?.logging
  if (!log?.enabled) return ''

  const lines = [
    '# Structured logging',
    'import logging',
    log.format === 'json' ? 'import json' : '',
    log.logToFile ? 'from logging.handlers import RotatingFileHandler' : '',
    '',
    'class JsonFormatter(logging.Formatter):',
    '    def format(self, record):',
    '        payload = {"level": record.levelname, "message": record.getMessage(), "logger": record.name}',
    log.includeTraceId ? '        payload["trace_id"] = getattr(record, "trace_id", None)' : '',
    '        return json.dumps(payload)',
    '',
    'logger = logging.getLogger("langstitch")',
    `logger.setLevel(logging.${log.level.toUpperCase()})`,
    'handler = logging.StreamHandler()',
    log.format === 'json'
      ? 'handler.setFormatter(JsonFormatter())'
      : 'handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))',
    'logger.addHandler(handler)',
  ]
  if (log.logToFile) {
    lines.push(`file_handler = RotatingFileHandler("${log.filePath}", maxBytes=5_000_000, backupCount=3)`)
    lines.push('file_handler.setFormatter(handler.formatter)')
    lines.push('logger.addHandler(file_handler)')
  }
  if (log.includeNodeTiming) {
    lines.push('')
    lines.push('def log_node_timing(node_name: str, elapsed_ms: float):')
    lines.push('    logger.info("node_timing", extra={"node": node_name, "elapsed_ms": elapsed_ms})')
  }
  return lines.filter(Boolean).join('\n') + '\n'
}

function generateObservabilitySetup(doc: GraphDocument): string {
  const obs = doc.settings?.observability
  if (!obs?.enabled) return generateLoggingSetup(doc)

  const events = obs.auditEvents
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  const lines: string[] = ['# Observability — LangSmith, Langfuse, audit emitters']
  lines.push('import os')
  lines.push('CALLBACK_HANDLERS = []')
  lines.push('')

  if (obs.langsmith?.enabled) {
    lines.push('# LangSmith tracing')
    lines.push(`os.environ.setdefault("LANGCHAIN_TRACING_V2", "${obs.langsmith.tracingV2 ? 'true' : 'false'}")`)
    lines.push(`os.environ.setdefault("LANGCHAIN_PROJECT", "${obs.langsmith.projectName}")`)
    lines.push(`# Set ${obs.langsmith.apiKeyEnv} in environment`)
    lines.push('')
  }

  if (obs.langfuse?.enabled) {
    lines.push('# Langfuse tracing')
    lines.push('try:')
    lines.push('    from langfuse.callback import CallbackHandler as LangfuseHandler')
    lines.push('    langfuse_handler = LangfuseHandler(')
    lines.push(`        public_key=os.environ.get("${obs.langfuse.publicKeyEnv}"),`)
    lines.push(`        secret_key=os.environ.get("${obs.langfuse.secretKeyEnv}"),`)
    lines.push(`        host="${obs.langfuse.host}",`)
    lines.push(`        release="${obs.langfuse.release}",`)
    lines.push('    )')
    lines.push('    CALLBACK_HANDLERS.append(langfuse_handler)')
    lines.push('except ImportError:')
    lines.push('    langfuse_handler = None  # pip install langfuse')
    lines.push('')
  }

  lines.push(generateLoggingSetup(doc).trim())
  lines.push('')
  lines.push(obs.customEmitterCode ?? '')
  lines.push('')
  lines.push(`AUDIT_EVENTS = {${events.map((e) => `"${e}"`).join(', ')}}`)
  lines.push('')
  lines.push(`def audit_wrap(node_name: str, fn):
    """Wrap node execution with audit + logging."""
    import time
    def wrapper(state):
        emit_audit_event("node_enter", {"node": node_name})
        start = time.perf_counter()
        try:
            result = fn(state)
            emit_audit_event("node_exit", {"node": node_name})
            return result
        except Exception as exc:
            emit_audit_event("error", {"node": node_name, "error": str(exc)})
            logger.exception("node_failed", extra={"node": node_name})
            raise
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            if ${obs.logging?.includeNodeTiming ?? true}:
                log_node_timing(node_name, elapsed)
    return wrapper`)

  return lines.join('\n') + '\n'
}

function generateMcpStudioSetup(mcpServers: McpServerDefinition[]): string {
  if (!mcpServers.length) return ''
  const lines = [
    '# MCP Studio — LangGraph-compatible MCP server definitions',
    '# pip install langchain-mcp-adapters',
    '',
    'MCP_SERVERS = {',
  ]
  for (const s of mcpServers) {
    if (s.transport === 'stdio') {
      lines.push(`    "${s.id}": {`)
      lines.push(`        "transport": "stdio",`)
      lines.push(`        "command": ${JSON.stringify(s.command)},`)
      lines.push(`        "args": ${JSON.stringify(s.args.split(' ').filter(Boolean))},`)
      if (s.envVars) lines.push(`        "env": {${s.envVars.split(',').map((p) => {
        const [k, v] = p.split('=').map((x) => x.trim())
        return k ? `"${k}": "${v ?? ''}"` : ''
      }).filter(Boolean).join(', ')}},`)
      lines.push('    },')
    } else {
      lines.push(`    "${s.id}": {"transport": "${s.transport}", "url": "${s.url}"},`)
    }
  }
  lines.push('}')
  lines.push('')
  lines.push('MCP_TOOLS = {')
  for (const s of mcpServers) {
    for (const t of s.tools) {
      lines.push(`    "${s.id}:${t.name}": {"server": "${s.id}", "name": "${t.name}", "description": ${JSON.stringify(t.description)}},`)
    }
  }
  lines.push('}')
  lines.push('')
  lines.push('MCP_RESOURCES = {')
  for (const s of mcpServers) {
    for (const r of s.resources) {
      lines.push(`    "${r.uri}": {"server": "${s.id}", "name": "${r.name}", "mime": "${r.mimeType}"},`)
    }
  }
  lines.push('}')
  lines.push('')
  lines.push('async def load_mcp_tools():')
  lines.push('    """Load tools from MCP Studio servers at runtime."""')
  lines.push('    from langchain_mcp_adapters.client import MultiServerMCPClient')
  lines.push('    client = MultiServerMCPClient(MCP_SERVERS)')
  lines.push('    return await client.get_tools()')
  return lines.join('\n') + '\n'
}

function generateToolRegistry(tools: ToolDefinition[]): string {
  if (!tools.length) return ''
  const lines = ['# Tool registry', 'TOOL_REGISTRY = {']
  for (const t of tools) {
    lines.push(`    "${t.id}": {`)
    lines.push(`        "name": "${t.name}",`)
    lines.push(`        "description": ${JSON.stringify(t.description)},`)
    lines.push(`        "source": "${t.source}",`)
    if (t.source === 'mcp') {
      lines.push(`        "mcp_server": "${t.mcpServerId}",`)
      lines.push(`        "mcp_tool": "${t.mcpToolName}",`)
    }
    if (t.source === 'http') lines.push(`        "endpoint": "${t.httpEndpoint}",`)
    if (t.source === 'python') lines.push(`        # inline python tool defined below`)
    lines.push('    },')
  }
  lines.push('}')
  lines.push('')
  for (const t of tools.filter((x) => x.source === 'python')) {
    lines.push(t.pythonCode)
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

function generateAgentRegistry(agents: AgentDefinition[], doc: GraphDocument): string {
  if (!agents.length) return ''
  const lines = ['# Agent registry — sub-agents, remote, A2A', 'AGENT_REGISTRY = {']
  for (const a of agents) {
    lines.push(`    "${a.id}": {`)
    lines.push(`        "name": "${a.name}",`)
    lines.push(`        "kind": "${a.kind}",`)
    lines.push(`        "model": "${a.model}",`)
    lines.push(`        "tools": ${JSON.stringify(a.toolIds)},`)
    if (a.kind === 'subagent') lines.push(`        "subgraph_id": "${a.subgraphId}",`)
    if (a.kind === 'remote') lines.push(`        "url": "${a.remoteUrl}",`)
    if (a.kind === 'a2a') lines.push(`        "agent_card": "${a.a2aAgentCardUrl}",`)
    lines.push('    },')
  }
  lines.push('}')
  const a2a = doc.settings?.a2a
  if (a2a?.enabled) {
    lines.push('')
    lines.push('# A2A protocol client')
    lines.push('A2A_CONFIG = {')
    lines.push(`    "agent_card_url": "${a2a.agentCardUrl}",`)
    lines.push(`    "skill_id": "${a2a.skillId}",`)
    lines.push(`    "protocol_version": "${a2a.protocolVersion}",`)
    lines.push(`    "auth_env": "${a2a.authEnvVar}",`)
    lines.push('}')
    lines.push('')
    lines.push('async def invoke_a2a_agent(agent_card_url: str, message: dict) -> dict:')
    lines.push('    """Invoke an A2A-compatible remote agent."""')
    lines.push('    import httpx')
    lines.push('    headers = {}')
    lines.push(`    token = os.environ.get("${a2a.authEnvVar}")`)
    lines.push('    if token:')
    lines.push('        headers["Authorization"] = f"Bearer {token}"')
    lines.push('    # Fetch agent card, send message per A2A protocol')
    lines.push('    async with httpx.AsyncClient() as client:')
    lines.push('        card = await client.get(agent_card_url, headers=headers)')
    lines.push('        card.raise_for_status()')
    lines.push('        # TODO: implement A2A message/send per protocol version')
    lines.push('        return {"messages": [{"role": "assistant", "content": "A2A response stub"}]}')
  }
  return lines.join('\n') + '\n'
}

function generateRemoteGraphRefs(remoteGraphs: RemoteGraphRef[]): string {
  if (!remoteGraphs.length) return ''
  const lines = ['# Remote graph registry']
  for (const ref of remoteGraphs) {
    lines.push(`# Remote: ${ref.name} @ ${ref.url} (auth: ${ref.authEnvVar || 'none'})`)
  }
  lines.push('')
  lines.push('REMOTE_GRAPHS = {')
  for (const ref of remoteGraphs) {
    lines.push(`    "${ref.id}": {"url": "${ref.url}", "name": "${ref.name}", "version": "${ref.version}"},`)
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

function generateNodeFunction(
  node: Node<StitchNodeData>,
  remoteGraphs: RemoteGraphRef[],
  toolRegistry: ToolDefinition[],
  agentRegistry: AgentDefinition[],
  componentRegistry: ComponentManifest[] = [],
): string {
  const data = node.data
  const fnName = slugify(node.id)

  switch (data.kind) {
    case 'start':
    case 'end':
      return ''
    case 'llm': {
      const tools = (data.boundToolIds ?? []).join(', ')
      const agents = (data.boundAgentIds ?? []).join(', ')
      return `def ${fnName}(state: State) -> dict:\n    """${data.description ?? data.label}"""\n    # model=${data.model} tools=[${tools}] agents=[${agents}]\n    system = ${JSON.stringify(data.systemPrompt)}\n    user = ${JSON.stringify(data.userPrompt ?? '{input}')}.format(**state)\n    # llm = init_chat_model("${data.model}", callbacks=CALLBACK_HANDLERS)\n    # llm_with_tools = llm.bind_tools([TOOL_REGISTRY[t] for t in [${(data.boundToolIds ?? []).map((id) => `"${id}"`).join(', ')}]])\n    return {"${data.outputKey}": [{"role": "assistant", "content": f"Response from ${data.model}"}]}\n`
    }
    case 'tool': {
      const conn = data.connectionType ?? 'inline'
      if (conn === 'registry' && data.toolRegistryId) {
        const reg = toolRegistry.find((t) => t.id === data.toolRegistryId)
        return `def ${fnName}(state: State) -> dict:\n    """Registry tool: ${reg?.name ?? data.toolRegistryId}"""\n    emit_audit_event("tool_call", {"tool": "${data.toolRegistryId}", "source": "registry"})\n    query = state.get("${data.inputKey}", "")\n    # tool = TOOL_REGISTRY["${data.toolRegistryId}"]\n    result = f"Tool ${reg?.name ?? data.toolName} executed with: {query}"\n    return {"${data.outputKey}": result}\n`
      }
      if (conn === 'mcp') {
        return `def ${fnName}(state: State) -> dict:\n    """MCP tool: ${data.mcpServerId}:${data.mcpToolName}"""\n    emit_audit_event("mcp_call", {"server": "${data.mcpServerId}", "tool": "${data.mcpToolName}"})\n    # mcp_tools = await load_mcp_tools()\n    query = state.get("${data.inputKey}", "")\n    result = f"MCP ${data.mcpToolName} executed with: {query}"\n    return {"${data.outputKey}": result}\n`
      }
      return `def ${fnName}(state: State) -> dict:\n    """Tool: ${data.toolName} — ${data.toolDescription}"""\n    emit_audit_event("tool_call", {"tool": "${data.toolName}"})\n    query = state.get("${data.inputKey}", "")\n    result = f"Tool ${data.toolName} executed with: {query}"\n    return {"${data.outputKey}": result}\n`
    }
    case 'agent': {
      if (data.connectionType === 'a2a') {
        const agent = agentRegistry.find((a) => a.id === data.a2aAgentId)
        return `async def ${fnName}(state: State) -> dict:\n    """A2A agent: ${agent?.name ?? data.a2aAgentId}"""\n    emit_audit_event("a2a_message", {"agent": "${data.a2aAgentId}"})\n    # result = await invoke_a2a_agent("${agent?.a2aAgentCardUrl ?? ''}", state)\n    return ${data.outputMapping || '{}'}\n`
      }
      if (data.connectionType === 'remote') {
        const agent = agentRegistry.find((a) => a.id === data.remoteAgentId)
        return `def ${fnName}(state: State) -> dict:\n    """Remote agent: ${agent?.name ?? data.remoteAgentId}"""\n    emit_audit_event("agent_delegate", {"agent": "${data.remoteAgentId}", "type": "remote"})\n    # POST ${agent?.remoteUrl ?? 'UNSET'}\n    return ${data.outputMapping || '{}'}\n`
      }
      if (data.connectionType === 'subagent') {
        return `def ${fnName}(state: State) -> dict:\n    """Sub-agent subgraph: ${data.subgraphId}"""\n    emit_audit_event("agent_delegate", {"agent": "${data.subgraphId}", "type": "subagent"})\n    # result = ${slugify(data.subgraphId)}_graph.invoke(${data.inputMapping || '{}'})\n    return ${data.outputMapping || '{}'}\n`
      }
      const agent = agentRegistry.find((a) => a.id === data.agentRegistryId)
      return `def ${fnName}(state: State) -> dict:\n    """Agent: ${agent?.name ?? data.agentRegistryId}"""\n    emit_audit_event("agent_delegate", {"agent": "${data.agentRegistryId}"})\n    return ${data.outputMapping || '{}'}\n`
    }
    case 'function':
      return `${data.code.replace(/^def\s+\w+/, `def ${fnName}`)}\n`
    case 'router':
      return `${data.routerFn.replace(/^def\s+\w+/, `def ${fnName}_route`)}\n`
    case 'intent_classifier':
      return `${data.classifierFn.replace(/^def\s+\w+/, `def ${fnName}_route`)}\n`
    case 'rag': {
      const pipeline = data.pipelineId || 'rag_default'
      return `def ${fnName}(state: State) -> dict:\n    """RAG Agent: ${data.label} — pipeline ${pipeline}"""\n    query = state.get("${data.queryKey}", "")\n    emit_audit_event("rag_retrieve", {"pipeline": "${pipeline}"})\n    # Wire to rag.pipeline.run_pipeline at deploy time\n    context = [f"Retrieved context for: {query}"]\n    out = {"${data.outputKey}": context}\n    if ${data.includeSources ?? true}:\n        out["rag_sources"] = context\n    return out\n`
    }
    case 'subgraph': {
      if (data.connectionType === 'remote') {
        const remote = remoteGraphs.find((r) => r.id === data.remoteGraphId)
        const endpoint = data.remoteEndpoint || remote?.url || 'UNSET'
        return `def ${fnName}(state: State) -> dict:\n    """Remote subgraph: ${data.label}"""\n    # Endpoint: ${endpoint}\n    # input_map=${data.inputMapping}\n    # output_map=${data.outputMapping}\n    # TODO: invoke remote graph via langgraph SDK\n    return {}\n`
      }
      return `def ${fnName}(state: State) -> dict:\n    """Local subgraph: ${data.subgraphId || 'UNSET'}"""\n    # Compiled subgraph module invoked here\n    subgraph_input = ${data.inputMapping || '{}'}\n    # result = compiled_subgraph.invoke(subgraph_input)\n    return ${data.outputMapping || '{}'}\n`
    }
    case 'custom': {
      const manifest = componentRegistry.find((c) => c.id === data.componentId)
      if (!manifest) {
        return `def ${fnName}(state: State) -> dict:\n    """Missing component: ${data.componentId}"""\n    return {}\n`
      }
      const ctx = buildRenderContext({
        nodeName: fnName,
        label: data.label,
        description: data.description ?? manifest.description ?? data.label,
        outputKey: data.outputKey ?? '',
        configFields: manifest.configFields.map((f) => ({ id: f.id, kind: f.kind })),
        config: data.config ?? {},
      })
      const { code } = renderTemplate(manifest.codegen.template, ctx)
      return code.endsWith('\n') ? code : code + '\n'
    }
    default:
      return ''
  }
}

/** Collect, dedupe, and sort custom-component import lines for hoisting. */
function collectComponentImports(
  canvases: Record<string, CanvasSnapshot>,
  componentRegistry: ComponentManifest[],
): string[] {
  const imports = new Set<string>()
  for (const canvas of Object.values(canvases)) {
    for (const node of canvas.nodes) {
      if (node.data.kind !== 'custom') continue
      const manifest = componentRegistry.find((c) => c.id === node.data.componentId)
      for (const line of manifest?.codegen.imports ?? []) {
        const trimmed = line.trim()
        if (trimmed) imports.add(trimmed)
      }
    }
  }
  return [...imports].sort()
}

function getNodeName(node: Node<StitchNodeData>): string {
  return slugify(node.id)
}

/** Node kinds we fully own and can safely register with the SDK ``@graph_node``. */
const DECORATABLE_NODE_KINDS = new Set<StitchNodeData['kind']>([
  'llm',
  'tool',
  'agent',
  'rag',
  'subgraph',
])

/** Prefix a generated node `def` with an `@graph_node(...)` registration decorator. */
function decorateNode(node: Node<StitchNodeData>, code: string): string {
  if (!code) return code
  if (!DECORATABLE_NODE_KINDS.has(node.data.kind)) return code
  const description = JSON.stringify(node.data.description ?? node.data.label ?? '')
  return `@graph_node(description=${description})\n${code}`
}

/**
 * Emit one graph as an SDK `@graph` build function plus its compile line.
 *
 * The build function returns a `GraphBuilder` (registered on the LangStitch
 * registry); the compile line materializes a module-level compiled graph for
 * backward-compatible direct import (`from ...graphs.main import graph`).
 */
function generateGraphBuilder(
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  graphName = 'main',
  settings = DEFAULT_GRAPH_SETTINGS,
): { fn: string; compile: string } {
  const isMain = graphName === 'main' || graphName === 'Main Graph'
  const graphVar = isMain ? 'graph' : `${slugify(graphName)}_graph`
  const buildFn = isMain ? 'build_main' : `build_${slugify(graphName)}`
  const body: string[] = []
  body.push(`    builder = GraphBuilder(${JSON.stringify(graphName)}, state_schema=State)`)

  for (const node of nodes) {
    if (node.data.kind === 'start' || node.data.kind === 'end') continue
    body.push(`    builder.add_node("${getNodeName(node)}", ${getNodeName(node)})`)
  }

  const startNode = nodes.find((n) => n.data.kind === 'start')
  const endNode = nodes.find((n) => n.data.kind === 'end')

  if (startNode) {
    const startEdge = edges.find((e) => e.source === startNode.id)
    if (startEdge) {
      body.push(`    builder.add_edge(START, "${getNodeName(nodes.find((n) => n.id === startEdge.target)!)}")`)
    }
  }

  const routerNodes = nodes.filter((n) => n.data.kind === 'router' || n.data.kind === 'intent_classifier')
  const routerIds = new Set(routerNodes.map((n) => n.id))

  for (const edge of edges) {
    if (startNode && edge.source === startNode.id) continue
    if (endNode && edge.target === endNode.id) {
      if (routerIds.has(edge.source)) continue
      body.push(`    builder.add_edge("${getNodeName(nodes.find((n) => n.id === edge.source)!)}", END)`)
      continue
    }
    if (routerIds.has(edge.source)) continue

    const source = nodes.find((n) => n.id === edge.source)
    const target = nodes.find((n) => n.id === edge.target)
    if (!source || !target || source.data.kind === 'start' || target.data.kind === 'end') continue
    body.push(`    builder.add_edge("${getNodeName(source)}", "${getNodeName(target)}")`)
  }

  for (const router of routerNodes) {
    const routerEdges = edges.filter((e) => e.source === router.id && e.target !== endNode?.id)
    const pathMap = router.data.kind === 'router' || router.data.kind === 'intent_classifier'
      ? (router.data.kind === 'router' ? router.data.branches : router.data.intents)
          .filter((b: RouterBranch | { id: string; label: string }) =>
            routerEdges.some((e) => e.sourceHandle === b.id) || ('targetNodeId' in b && b.targetNodeId),
          )
          .map((branch: RouterBranch | { id: string; label: string }) => {
            const edge = routerEdges.find((e) => e.sourceHandle === branch.id)
            const targetNode = edge ? nodes.find((n) => n.id === edge.target) : undefined
            const target = targetNode?.data.kind === 'end' ? 'END' : `"${targetNode ? getNodeName(targetNode) : branch.label}"`
            return `            "${branch.label}": ${target}`
          })
          .join(',\n')
      : ''

    body.push(
      `    builder.add_conditional_edges(\n        "${getNodeName(router)}",\n        ${getNodeName(router)}_route,\n        {\n${pathMap}\n        },\n    )`,
    )
  }

  body.push('    return builder')

  const decorator = isMain
    ? `@graph(name=${JSON.stringify(graphName)}, entrypoint=True)`
    : `@graph(name=${JSON.stringify(graphName)})`
  const fn = `# --- ${graphName} graph ---\n${decorator}\ndef ${buildFn}() -> GraphBuilder:\n${body.join('\n')}`

  const compileArgs: string[] = []
  if (settings.checkpointer?.manager && settings.checkpointer.manager !== 'none') {
    compileArgs.push('checkpointer=checkpointer')
  }
  if (settings.interruptBefore) {
    const interruptNodes = settings.interruptBefore.split(',').map((n) => n.trim()).filter(Boolean)
    if (interruptNodes.length)
      compileArgs.push(`interrupt_before=[${interruptNodes.map((n) => `"${n}"`).join(', ')}]`)
  }

  const compile = compileArgs.length
    ? `${graphVar} = ${buildFn}().compile(${compileArgs.join(', ')})`
    : `${graphVar} = ${buildFn}().compile()`

  return { fn, compile }
}

export function generatePythonCode(
  doc: GraphDocument,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  canvasByGraph?: Record<string, CanvasSnapshot>,
): string {
  const remoteGraphs = doc.remoteGraphs ?? []
  const toolRegistry = doc.toolRegistry ?? []
  const agentRegistry = doc.agentRegistry ?? []
  const mcpServers = doc.mcpServers ?? []
  const componentRegistry = doc.componentRegistry ?? []
  const allCanvases = canvasByGraph ?? { [MAIN_GRAPH_ID]: { nodes, edges } }

  const functions = Object.entries(allCanvases)
    .flatMap(([, canvas]) =>
      canvas.nodes.map((n) =>
        decorateNode(
          n,
          generateNodeFunction(n, remoteGraphs, toolRegistry, agentRegistry, componentRegistry),
        ),
      ),
    )
    .filter(Boolean)
    .join('\n')

  const componentImports = collectComponentImports(allCanvases, componentRegistry)

  const stateClass = generateStateClass(doc.stateFields)
  const lifecycle = generateLifecycleHooks(doc)
  const checkpointer = generateCheckpointerSetup(doc)
  const observability = generateObservabilitySetup(doc)
  const remoteRefs = generateRemoteGraphRefs(remoteGraphs)
  const mcpSetup = generateMcpStudioSetup(mcpServers)
  const toolsSetup = generateToolRegistry(toolRegistry)
  const agentsSetup = generateAgentRegistry(agentRegistry, doc)

  const settings = doc.settings ?? DEFAULT_GRAPH_SETTINGS
  const evalCfg = settings.eval
  // cycles 87, 147, 207, 267, 327, 387, 447, 507, 567, 627, 687, 747 — eval-dataset comment header in generated Python module docstring
  const evalDatasetLine =
    evalCfg?.enabled && (evalCfg.datasetName || evalCfg.datasetId)
      ? `Eval dataset: ${evalCfg.datasetName || evalCfg.datasetId}`
      : ''

  const builderParts = Object.entries(allCanvases).map(([id, canvas]) => {
    const sg = doc.subgraphs.find((s) => s.id === id)
    return generateGraphBuilder(canvas.nodes, canvas.edges, sg?.name ?? id, settings)
  })
  const builderFns = builderParts.map((p) => p.fn).join('\n\n')
  // Compile lines run last so every @graph build function is registered before
  // any module-level compiled graph (e.g. `graph`) is materialized.
  const compileLines = builderParts.map((p) => p.compile).join('\n')

  return `"""Generated by LangStitch — ${doc.name}
${doc.description ?? 'Visual LangGraph definition'}
Settings: checkpoint=${settings.checkpoint}, max_steps=${settings.maxSteps}
Lifecycle: on_startup/on_shutdown hooks included
Observability: LangSmith=${settings.observability?.langsmith?.enabled} Langfuse=${settings.observability?.langfuse?.enabled}
Tools: ${toolRegistry.length} · Agents: ${agentRegistry.length} · MCP servers: ${mcpServers.length}
${evalDatasetLine ? `${evalDatasetLine}\n` : ''}"""

import os
from langstitch import graph_node, graph, GraphBuilder, START, END, human_interrupt
${componentImports.length ? '\n' + componentImports.join('\n') + '\n' : ''}
${stateClass}

${lifecycle}
${checkpointer}
${observability}
${mcpSetup}
${toolsSetup}
${agentsSetup}
${remoteRefs}
${functions}
${builderFns}
${compileLines}

if __name__ == "__main__":
    on_startup({})
    try:
        result = graph.invoke({"messages": []}, config={"callbacks": CALLBACK_HANDLERS})
        print(result)
    finally:
        on_shutdown({})
`
}

/**
 * Serialize a React Flow edge for persistence. Keeps the visual fields
 * (`animated`, `style`, `markerEnd`, `type`) so the moving dashed connector and
 * per-source colour survive a save → reload round-trip.
 */
function serializeEdge(edge: Edge): Partial<Edge> {
  const { id, source, target, sourceHandle, targetHandle, label, animated, style, markerEnd, type } =
    edge
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    label,
    animated,
    style,
    markerEnd,
    type,
  }
}

export function exportGraphDocument(
  doc: GraphDocument,
  nodes: Node<StitchNodeData>[],
  edges: Edge[],
  canvasByGraph?: Record<string, CanvasSnapshot>,
  navigationPath?: string[],
): string {
  const canvases = canvasByGraph ?? { [doc.activeSubgraphId || MAIN_GRAPH_ID]: { nodes, edges } }
  return JSON.stringify(
    {
      ...doc,
      canvasByGraph: Object.fromEntries(
        Object.entries(canvases).map(([id, canvas]) => [
          id,
          {
            nodes: canvas.nodes.map(({ id: nid, type, position, data }) => ({ id: nid, type, position, data })),
            edges: canvas.edges.map(serializeEdge),
          },
        ]),
      ),
      navigationPath: navigationPath ?? [doc.activeSubgraphId || MAIN_GRAPH_ID],
      nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
      edges: edges.map(serializeEdge),
    },
    null,
    2,
  )
}

export function createDefaultDocument(): GraphDocument {
  return {
    version: '1.2',
    name: 'my_langgraph',
    description: 'A LangGraph workflow built with LangStitch',
    projectVersion: '0.1.0',
    stateFields: [
      { id: 'sf1', name: 'messages', type: 'messages', reducer: 'append' },
      { id: 'sf2', name: 'query', type: 'str', reducer: 'replace', defaultValue: '""' },
    ],
    subgraphs: [
      {
        id: MAIN_GRAPH_ID,
        name: 'Main Graph',
        parentId: null,
        stateFields: [],
        nodeIds: [],
        edgeIds: [],
      },
    ],
    activeSubgraphId: MAIN_GRAPH_ID,
    remoteGraphs: [],
    toolRegistry: [],
    agentRegistry: [],
    mcpServers: [],
    skillRegistry: [
      {
        id: 'skill_default',
        name: 'Default Skill',
        description: 'General-purpose assistant skill',
        instructions: 'Answer helpfully using available tools and context.',
        toolIds: [],
        personaId: 'persona_default',
        promptTemplate: 'Task: {input}\nContext: {context}',
        tags: 'default',
      },
    ],
    guardrailRegistry: [
      {
        id: 'guardrail_safe',
        name: 'Safety Guardrail',
        description: 'Block unsafe content',
        type: 'both',
        policy: 'Do not generate harmful, illegal, or abusive content.',
        action: 'block',
        severity: 'high',
        enabled: true,
      },
    ],
    businessRuleRegistry: [
      {
        id: 'rule_escalate',
        name: 'Escalate VIP',
        description: 'Route VIP users to priority handler',
        condition: 'context.get("tier") == "vip"',
        action: 'route_to_priority',
        priority: 10,
        enabled: true,
      },
    ],
    personaRegistry: [
      {
        id: 'persona_default',
        name: 'Default Persona',
        role: 'Helpful assistant',
        tone: 'Professional and concise',
        systemPrompt: 'You are a knowledgeable assistant for the user.',
        constraints: 'Be accurate; cite uncertainty when unsure.',
        vocabulary: '',
      },
    ],
    ragPipelines: [
      {
        id: 'rag_default',
        name: 'Default RAG',
        description: 'Hybrid retrieval pipeline',
        chunkStrategy: 'recursive',
        chunkSize: 512,
        chunkOverlap: 64,
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        retrievalMode: 'hybrid',
        vectorStore: 'in_memory',
        topK: 5,
        rerankEnabled: false,
        rerankModel: '',
        sourcePaths: './data/docs',
        metadataFilters: '',
      },
    ],
    componentRegistry: [...BUILTIN_MANIFESTS],
    settings: mergeGraphSettings(),
  }
}

export function createSubgraph(name: string, parentId: string | null = MAIN_GRAPH_ID): SubgraphDefinition {
  const id = `sg_${slugify(name)}_${Date.now().toString(36)}`
  return {
    id,
    name,
    parentId,
    stateFields: [],
    nodeIds: [],
    edgeIds: [],
  }
}
