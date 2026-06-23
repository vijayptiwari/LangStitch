import { Plus, Trash2 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import type {
  AgentDefinition,
  AgentKind,
  McpResourceDef,
  McpServerDefinition,
  McpToolDef,
  McpTransport,
  ToolDefinition,
  ToolSourceType,
} from '../../types/graph'
import { MCP_TOOL_TEMPLATE } from '../../lib/designerConstants'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="designer-section">
      <h4 className="designer-section-title">{title}</h4>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  )
}

export function IntegrationsPanel() {
  const document = useGraphStore((s) => s.document)
  const addToolDefinition = useGraphStore((s) => s.addToolDefinition)
  const updateToolDefinition = useGraphStore((s) => s.updateToolDefinition)
  const removeToolDefinition = useGraphStore((s) => s.removeToolDefinition)
  const addAgentDefinition = useGraphStore((s) => s.addAgentDefinition)
  const updateAgentDefinition = useGraphStore((s) => s.updateAgentDefinition)
  const removeAgentDefinition = useGraphStore((s) => s.removeAgentDefinition)
  const addMcpServer = useGraphStore((s) => s.addMcpServer)
  const updateMcpServer = useGraphStore((s) => s.updateMcpServer)
  const removeMcpServer = useGraphStore((s) => s.removeMcpServer)

  const tools = document.toolRegistry ?? []
  const agents = document.agentRegistry ?? []
  const mcpServers = document.mcpServers ?? []

  const handleAddTool = () => {
    const tool: ToolDefinition = {
      id: `tool_${Date.now().toString(36)}`,
      name: 'search',
      description: 'Search the web for information',
      source: 'python',
      mcpServerId: '',
      mcpToolName: '',
      inputSchema: MCP_TOOL_TEMPLATE,
      pythonCode: 'def search(query: str) -> str:\n    return f"Results for {query}"',
      httpEndpoint: '',
      tags: '',
    }
    addToolDefinition(tool)
  }

  const handleAddAgent = () => {
    const agent: AgentDefinition = {
      id: `agent_${Date.now().toString(36)}`,
      name: 'Research Agent',
      description: 'Specialist sub-agent for research tasks',
      kind: 'subagent',
      subgraphId: '',
      remoteUrl: '',
      a2aAgentCardUrl: '',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a research specialist.',
      toolIds: [],
      authEnvVar: '',
    }
    addAgentDefinition(agent)
  }

  const handleAddMcpServer = () => {
    const server: McpServerDefinition = {
      id: `mcp_${Date.now().toString(36)}`,
      name: 'Filesystem MCP',
      transport: 'stdio',
      command: 'npx',
      args: '-y @modelcontextprotocol/server-filesystem /data',
      url: '',
      envVars: '',
      tools: [],
      resources: [],
    }
    addMcpServer(server)
  }

  const addMcpTool = (serverId: string) => {
    const server = mcpServers.find((s) => s.id === serverId)
    if (!server) return
    const tool: McpToolDef = {
      id: `mt_${Date.now().toString(36)}`,
      name: 'read_file',
      description: 'Read a file from disk',
      inputSchema: MCP_TOOL_TEMPLATE,
    }
    updateMcpServer(serverId, { tools: [...server.tools, tool] })
  }

  const addMcpResource = (serverId: string) => {
    const server = mcpServers.find((s) => s.id === serverId)
    if (!server) return
    const resource: McpResourceDef = {
      id: `mr_${Date.now().toString(36)}`,
      uri: 'file:///data/readme.md',
      name: 'readme',
      description: 'Project readme',
      mimeType: 'text/markdown',
    }
    updateMcpServer(serverId, { resources: [...server.resources, resource] })
  }

  return (
    <>
      <Section title="Tool registry">
        <p className="designer-hint">
          Central catalog of tools — bind from Tool nodes or LLM agent tool lists. Supports MCP, Python, HTTP, LangChain.
        </p>
        {tools.map((tool) => (
          <div key={tool.id} className="registry-card">
            <div className="registry-card-header">
              <input
                className="input"
                value={tool.name}
                placeholder="Tool name"
                onChange={(e) => updateToolDefinition(tool.id, { name: e.target.value })}
              />
              <select
                className="input"
                value={tool.source}
                onChange={(e) => updateToolDefinition(tool.id, { source: e.target.value as ToolSourceType })}
              >
                <option value="builtin">Built-in</option>
                <option value="mcp">MCP Studio</option>
                <option value="python">Python</option>
                <option value="http">HTTP API</option>
                <option value="langchain">LangChain tool</option>
              </select>
              <button className="btn-danger-sm" type="button" onClick={() => removeToolDefinition(tool.id)}>
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              className="textarea"
              rows={2}
              value={tool.description}
              placeholder="Description for the agent"
              onChange={(e) => updateToolDefinition(tool.id, { description: e.target.value })}
            />
            {tool.source === 'mcp' && (
              <div className="registry-card-row">
                <select
                  className="input"
                  value={tool.mcpServerId}
                  onChange={(e) => updateToolDefinition(tool.id, { mcpServerId: e.target.value })}
                >
                  <option value="">MCP server…</option>
                  {mcpServers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input
                  className="input"
                  value={tool.mcpToolName}
                  placeholder="MCP tool name"
                  onChange={(e) => updateToolDefinition(tool.id, { mcpToolName: e.target.value })}
                />
              </div>
            )}
            {tool.source === 'python' && (
              <textarea
                className="textarea code designer-code"
                rows={4}
                value={tool.pythonCode}
                onChange={(e) => updateToolDefinition(tool.id, { pythonCode: e.target.value })}
              />
            )}
            {tool.source === 'http' && (
              <input
                className="input"
                value={tool.httpEndpoint}
                placeholder="https://api.example.com/tools/search"
                onChange={(e) => updateToolDefinition(tool.id, { httpEndpoint: e.target.value })}
              />
            )}
            <textarea
              className="textarea code"
              rows={3}
              value={tool.inputSchema}
              placeholder="JSON Schema"
              onChange={(e) => updateToolDefinition(tool.id, { inputSchema: e.target.value })}
            />
          </div>
        ))}
        <button className="btn-secondary-sm" type="button" onClick={handleAddTool}>
          <Plus size={12} /> Add tool
        </button>
      </Section>

      <Section title="Agent registry">
        <p className="designer-hint">
          Sub-agents, remote agents, and A2A agents — connect from Agent nodes or bind to LLM nodes.
        </p>
        {agents.map((agent) => (
          <div key={agent.id} className="registry-card registry-card--agent">
            <div className="registry-card-header">
              <input
                className="input"
                value={agent.name}
                placeholder="Agent name"
                onChange={(e) => updateAgentDefinition(agent.id, { name: e.target.value })}
              />
              <select
                className="input"
                value={agent.kind}
                onChange={(e) => updateAgentDefinition(agent.id, { kind: e.target.value as AgentKind })}
              >
                <option value="subagent">Sub-agent (local subgraph)</option>
                <option value="remote">Remote agent</option>
                <option value="a2a">A2A agent</option>
                <option value="supervisor">Supervisor</option>
              </select>
              <button className="btn-danger-sm" type="button" onClick={() => removeAgentDefinition(agent.id)}>
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              className="textarea"
              rows={2}
              value={agent.description}
              onChange={(e) => updateAgentDefinition(agent.id, { description: e.target.value })}
            />
            {agent.kind === 'subagent' && (
              <select
                className="input"
                value={agent.subgraphId}
                onChange={(e) => updateAgentDefinition(agent.id, { subgraphId: e.target.value })}
              >
                <option value="">Target subgraph…</option>
                {document.subgraphs.map((sg) => (
                  <option key={sg.id} value={sg.id}>{sg.name}</option>
                ))}
              </select>
            )}
            {agent.kind === 'remote' && (
              <input
                className="input"
                value={agent.remoteUrl}
                placeholder="https://agents.example.com/v1/run"
                onChange={(e) => updateAgentDefinition(agent.id, { remoteUrl: e.target.value })}
              />
            )}
            {agent.kind === 'a2a' && (
              <input
                className="input"
                value={agent.a2aAgentCardUrl}
                placeholder="https://agent.example.com/.well-known/agent.json"
                onChange={(e) => updateAgentDefinition(agent.id, { a2aAgentCardUrl: e.target.value })}
              />
            )}
            <div className="registry-card-row">
              <input
                className="input"
                value={agent.model}
                placeholder="Model"
                onChange={(e) => updateAgentDefinition(agent.id, { model: e.target.value })}
              />
              <input
                className="input"
                value={agent.authEnvVar}
                placeholder="Auth env var"
                onChange={(e) => updateAgentDefinition(agent.id, { authEnvVar: e.target.value })}
              />
            </div>
            <Field label="Bound tools" hint="Comma-separated tool registry IDs">
              <input
                className="input"
                value={agent.toolIds.join(', ')}
                onChange={(e) =>
                  updateAgentDefinition(agent.id, {
                    toolIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </Field>
          </div>
        ))}
        <button className="btn-secondary-sm" type="button" onClick={handleAddAgent}>
          <Plus size={12} /> Add agent
        </button>
      </Section>

      <Section title="MCP Studio">
        <p className="designer-hint">
          Define MCP servers, tools, and resources — compatible with LangGraph Studio MCP integration.
        </p>
        {mcpServers.map((server) => (
          <div key={server.id} className="registry-card registry-card--mcp">
            <div className="registry-card-header">
              <input
                className="input"
                value={server.name}
                onChange={(e) => updateMcpServer(server.id, { name: e.target.value })}
              />
              <select
                className="input"
                value={server.transport}
                onChange={(e) => updateMcpServer(server.id, { transport: e.target.value as McpTransport })}
              >
                <option value="stdio">stdio</option>
                <option value="sse">SSE</option>
                <option value="streamable-http">Streamable HTTP</option>
              </select>
              <button className="btn-danger-sm" type="button" onClick={() => removeMcpServer(server.id)}>
                <Trash2 size={12} />
              </button>
            </div>
            {server.transport === 'stdio' ? (
              <>
                <input
                  className="input"
                  value={server.command}
                  placeholder="Command (e.g. npx)"
                  onChange={(e) => updateMcpServer(server.id, { command: e.target.value })}
                />
                <input
                  className="input"
                  value={server.args}
                  placeholder="Args"
                  onChange={(e) => updateMcpServer(server.id, { args: e.target.value })}
                />
              </>
            ) : (
              <input
                className="input"
                value={server.url}
                placeholder="Server URL"
                onChange={(e) => updateMcpServer(server.id, { url: e.target.value })}
              />
            )}
            <input
              className="input"
              value={server.envVars}
              placeholder="Env vars (KEY=val, KEY2=val2)"
              onChange={(e) => updateMcpServer(server.id, { envVars: e.target.value })}
            />

            <div className="mcp-subsection">
              <strong>MCP Tools</strong>
              {server.tools.map((tool) => (
                <div key={tool.id} className="mcp-item-row">
                  <input
                    className="input"
                    value={tool.name}
                    placeholder="Tool name"
                    onChange={(e) =>
                      updateMcpServer(server.id, {
                        tools: server.tools.map((t) =>
                          t.id === tool.id ? { ...t, name: e.target.value } : t,
                        ),
                      })
                    }
                  />
                  <input
                    className="input"
                    value={tool.description}
                    placeholder="Description"
                    onChange={(e) =>
                      updateMcpServer(server.id, {
                        tools: server.tools.map((t) =>
                          t.id === tool.id ? { ...t, description: e.target.value } : t,
                        ),
                      })
                    }
                  />
                  <button
                    className="btn-danger-sm"
                    type="button"
                    onClick={() =>
                      updateMcpServer(server.id, {
                        tools: server.tools.filter((t) => t.id !== tool.id),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button className="btn-secondary-sm" type="button" onClick={() => addMcpTool(server.id)}>
                + Tool
              </button>
            </div>

            <div className="mcp-subsection">
              <strong>MCP Resources</strong>
              {server.resources.map((res) => (
                <div key={res.id} className="mcp-item-row">
                  <input
                    className="input"
                    value={res.uri}
                    placeholder="URI"
                    onChange={(e) =>
                      updateMcpServer(server.id, {
                        resources: server.resources.map((r) =>
                          r.id === res.id ? { ...r, uri: e.target.value } : r,
                        ),
                      })
                    }
                  />
                  <input
                    className="input"
                    value={res.name}
                    placeholder="Name"
                    onChange={(e) =>
                      updateMcpServer(server.id, {
                        resources: server.resources.map((r) =>
                          r.id === res.id ? { ...r, name: e.target.value } : r,
                        ),
                      })
                    }
                  />
                  <button
                    className="btn-danger-sm"
                    type="button"
                    onClick={() =>
                      updateMcpServer(server.id, {
                        resources: server.resources.filter((r) => r.id !== res.id),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button className="btn-secondary-sm" type="button" onClick={() => addMcpResource(server.id)}>
                + Resource
              </button>
            </div>
          </div>
        ))}
        <button className="btn-secondary-sm" type="button" onClick={handleAddMcpServer}>
          <Plus size={12} /> Add MCP server
        </button>
      </Section>
    </>
  )
}
