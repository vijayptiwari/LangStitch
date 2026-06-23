import type { Edge, Node } from '@xyflow/react'
import type {
  AgentDefinition,
  CanvasSnapshot,
  GraphDocument,
  LGNodeData,
  McpServerDefinition,
  RemoteGraphRef,
  RouterBranch,
  StateField,
  SubgraphDefinition,
  ToolDefinition,
} from '../../types/graph'
import { slugify } from '../nodeRegistry'
import { DEFAULT_GRAPH_SETTINGS, mergeGraphSettings } from '../designerConstants'
import { MAIN_GRAPH_ID } from '../subgraphCanvas'

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
  node: Node<LGNodeData>,
  remoteGraphs: RemoteGraphRef[],
  toolRegistry: ToolDefinition[],
  agentRegistry: AgentDefinition[],
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
    case 'subgraph': {
      if (data.connectionType === 'remote') {
        const remote = remoteGraphs.find((r) => r.id === data.remoteGraphId)
        const endpoint = data.remoteEndpoint || remote?.url || 'UNSET'
        return `def ${fnName}(state: State) -> dict:\n    """Remote subgraph: ${data.label}"""\n    # Endpoint: ${endpoint}\n    # input_map=${data.inputMapping}\n    # output_map=${data.outputMapping}\n    # TODO: invoke remote graph via langgraph SDK\n    return {}\n`
      }
      return `def ${fnName}(state: State) -> dict:\n    """Local subgraph: ${data.subgraphId || 'UNSET'}"""\n    # Compiled subgraph module invoked here\n    subgraph_input = ${data.inputMapping || '{}'}\n    # result = compiled_subgraph.invoke(subgraph_input)\n    return ${data.outputMapping || '{}'}\n`
    }
    default:
      return ''
  }
}

function getNodeName(node: Node<LGNodeData>): string {
  return slugify(node.id)
}

function generateGraphBuilder(
  nodes: Node<LGNodeData>[],
  edges: Edge[],
  graphName = 'main',
  settings = DEFAULT_GRAPH_SETTINGS,
): string {
  const graphVar = graphName === 'main' || graphName === 'Main Graph' ? 'graph' : `${slugify(graphName)}_graph`
  const builder: string[] = []
  builder.push(`# --- ${graphName} graph ---`)
  builder.push(`builder = StateGraph(State)`)

  for (const node of nodes) {
    if (node.data.kind === 'start' || node.data.kind === 'end') continue
    builder.push(`builder.add_node("${getNodeName(node)}", ${getNodeName(node)})`)
  }

  const startNode = nodes.find((n) => n.data.kind === 'start')
  const endNode = nodes.find((n) => n.data.kind === 'end')

  if (startNode) {
    const startEdge = edges.find((e) => e.source === startNode.id)
    if (startEdge) {
      builder.push(`builder.add_edge(START, "${getNodeName(nodes.find((n) => n.id === startEdge.target)!)}")`)
    }
  }

  const routerNodes = nodes.filter((n) => n.data.kind === 'router')
  const routerIds = new Set(routerNodes.map((n) => n.id))

  for (const edge of edges) {
    if (startNode && edge.source === startNode.id) continue
    if (endNode && edge.target === endNode.id) {
      if (routerIds.has(edge.source)) continue
      builder.push(`builder.add_edge("${getNodeName(nodes.find((n) => n.id === edge.source)!)}", END)`)
      continue
    }
    if (routerIds.has(edge.source)) continue

    const source = nodes.find((n) => n.id === edge.source)
    const target = nodes.find((n) => n.id === edge.target)
    if (!source || !target || source.data.kind === 'start' || target.data.kind === 'end') continue
    builder.push(`builder.add_edge("${getNodeName(source)}", "${getNodeName(target)}")`)
  }

  for (const router of routerNodes) {
    const routerEdges = edges.filter((e) => e.source === router.id && e.target !== endNode?.id)
    const pathMap = router.data.kind === 'router'
      ? router.data.branches
          .filter((b: RouterBranch) => b.targetNodeId || routerEdges.some((e) => e.sourceHandle === b.id))
          .map((branch: RouterBranch) => {
            const edge = routerEdges.find((e) => e.sourceHandle === branch.id)
            const targetNode = edge ? nodes.find((n) => n.id === edge.target) : undefined
            const target = targetNode?.data.kind === 'end' ? 'END' : `"${targetNode ? getNodeName(targetNode) : branch.label}"`
            return `        "${branch.label}": ${target}`
          })
          .join(',\n')
      : ''

    builder.push(
      `builder.add_conditional_edges(\n    "${getNodeName(router)}",\n    ${getNodeName(router)}_route,\n    {\n${pathMap}\n    },\n)`,
    )
  }

  const compileArgs: string[] = []
  if (settings.checkpointer?.manager && settings.checkpointer.manager !== 'none') {
    compileArgs.push('checkpointer=checkpointer')
  }
  if (settings.interruptBefore) {
    const nodes = settings.interruptBefore.split(',').map((n) => n.trim()).filter(Boolean)
    if (nodes.length) compileArgs.push(`interrupt_before=[${nodes.map((n) => `"${n}"`).join(', ')}]`)
  }

  const compileLine = compileArgs.length
    ? `${graphVar} = builder.compile(${compileArgs.join(', ')})`
    : `${graphVar} = builder.compile()`

  builder.push(compileLine)
  return builder.join('\n')
}

export function generatePythonCode(
  doc: GraphDocument,
  nodes: Node<LGNodeData>[],
  edges: Edge[],
  canvasByGraph?: Record<string, CanvasSnapshot>,
): string {
  const remoteGraphs = doc.remoteGraphs ?? []
  const toolRegistry = doc.toolRegistry ?? []
  const agentRegistry = doc.agentRegistry ?? []
  const mcpServers = doc.mcpServers ?? []
  const allCanvases = canvasByGraph ?? { [MAIN_GRAPH_ID]: { nodes, edges } }

  const functions = Object.entries(allCanvases)
    .flatMap(([, canvas]) =>
      canvas.nodes.map((n) => generateNodeFunction(n, remoteGraphs, toolRegistry, agentRegistry)),
    )
    .filter(Boolean)
    .join('\n')

  const stateClass = generateStateClass(doc.stateFields)
  const lifecycle = generateLifecycleHooks(doc)
  const checkpointer = generateCheckpointerSetup(doc)
  const observability = generateObservabilitySetup(doc)
  const remoteRefs = generateRemoteGraphRefs(remoteGraphs)
  const mcpSetup = generateMcpStudioSetup(mcpServers)
  const toolsSetup = generateToolRegistry(toolRegistry)
  const agentsSetup = generateAgentRegistry(agentRegistry, doc)

  const settings = doc.settings ?? DEFAULT_GRAPH_SETTINGS

  const builders = Object.entries(allCanvases)
    .map(([id, canvas]) => {
      const sg = doc.subgraphs.find((s) => s.id === id)
      return generateGraphBuilder(canvas.nodes, canvas.edges, sg?.name ?? id, settings)
    })
    .join('\n\n')

  return `"""Generated by LangStitch — ${doc.name}
${doc.description ?? 'Visual LangGraph definition'}
Settings: checkpoint=${settings.checkpoint}, max_steps=${settings.maxSteps}
Lifecycle: on_startup/on_shutdown hooks included
Observability: LangSmith=${settings.observability?.langsmith?.enabled} Langfuse=${settings.observability?.langfuse?.enabled}
Tools: ${toolRegistry.length} · Agents: ${agentRegistry.length} · MCP servers: ${mcpServers.length}
"""

import os
from langgraph.graph import StateGraph, START, END

${stateClass}

${lifecycle}
${checkpointer}
${observability}
${mcpSetup}
${toolsSetup}
${agentsSetup}
${remoteRefs}
${functions}
${builders}

if __name__ == "__main__":
    on_startup({})
    try:
        result = graph.invoke({"messages": []}, config={"callbacks": CALLBACK_HANDLERS})
        print(result)
    finally:
        on_shutdown({})
`
}

export function exportGraphDocument(
  doc: GraphDocument,
  nodes: Node<LGNodeData>[],
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
            edges: canvas.edges.map(({ id: eid, source, target, sourceHandle, targetHandle, label }) => ({
              id: eid,
              source,
              target,
              sourceHandle,
              targetHandle,
              label,
            })),
          },
        ]),
      ),
      navigationPath: navigationPath ?? [doc.activeSubgraphId || MAIN_GRAPH_ID],
      nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
      edges: edges.map(({ id, source, target, sourceHandle, targetHandle, label }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        label,
      })),
    },
    null,
    2,
  )
}

export function createDefaultDocument(): GraphDocument {
  return {
    version: '1.0',
    name: 'my_langgraph',
    description: 'A LangGraph workflow built with LangStitch',
    stateFields: [
      { id: 'sf1', name: 'messages', type: 'messages', reducer: 'append' },
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
