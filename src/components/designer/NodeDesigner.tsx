import { useGraphStore } from '../../store/graphStore'
import type { LGNodeData, RouterBranch } from '../../types/graph'
import { getNodeTheme } from '../../lib/nodeTheme'
import {
  LLM_MODEL_PRESETS,
  PROMPT_TEMPLATES,
  ROUTER_TEMPLATES,
} from '../../lib/designerConstants'
import { Plus, Trash2 } from 'lucide-react'

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

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <Field label={`${label} (${value})`}>
      <input
        className="designer-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

export function NodeDesigner() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const document = useGraphStore((s) => s.document)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const removeNode = useGraphStore((s) => s.removeNode)

  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <div className="designer-empty">
        <div className="designer-empty-icon">◇</div>
        <h3>Node Designer</h3>
        <p>Click a node on the canvas to edit its properties, prompts, and routing logic.</p>
      </div>
    )
  }

  const data = node.data
  const theme = getNodeTheme(data.kind)
  const set = (patch: Partial<LGNodeData>) => updateNodeData(node.id, patch)

  return (
    <div className="designer-panel">
      <header className="designer-panel-header" style={{ '--accent': theme.color } as React.CSSProperties}>
        <div className="designer-panel-badge">{theme.typeLabel}</div>
        <h3>{data.label}</h3>
        <p className="designer-panel-id">{node.id}</p>
        {data.kind !== 'start' && data.kind !== 'end' && (
          <button className="btn-danger-sm designer-delete" onClick={() => removeNode(node.id)} type="button">
            <Trash2 size={12} /> Remove node
          </button>
        )}
      </header>

      <div className="designer-scroll">
        <Section title="Identity">
          <Field label="Display name">
            <input className="input" value={data.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Description" hint="Shown in generated code docstrings">
            <textarea
              className="textarea"
              rows={2}
              value={data.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What does this node do?"
            />
          </Field>
        </Section>

        {data.kind === 'llm' && (
          <>
            <Section title="Model">
              <Field label="Model">
                <input className="input" list="model-presets" value={data.model} onChange={(e) => set({ model: e.target.value })} />
                <datalist id="model-presets">
                  {LLM_MODEL_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <SliderField label="Temperature" value={data.temperature} min={0} max={2} step={0.1} onChange={(v) => set({ temperature: v })} />
              <SliderField label="Top P" value={data.topP ?? 1} min={0} max={1} step={0.05} onChange={(v) => set({ topP: v })} />
              <Field label="Max tokens">
                <input className="input" type="number" min={1} max={128000} value={data.maxTokens ?? 4096} onChange={(e) => set({ maxTokens: Number(e.target.value) })} />
              </Field>
            </Section>

            <Section title="Prompts">
              <Field label="Prompt template" hint="Quick-fill system + user prompts">
                <select
                  className="input"
                  defaultValue=""
                  onChange={(e) => {
                    const t = PROMPT_TEMPLATES.find((p) => p.id === e.target.value)
                    if (t) set({ systemPrompt: t.system, userPrompt: t.user })
                    e.target.value = ''
                  }}
                >
                  <option value="">Insert template…</option>
                  {PROMPT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="System prompt" hint="Instructions for the model">
                <textarea
                  className="textarea designer-prompt"
                  rows={5}
                  value={data.systemPrompt}
                  onChange={(e) => set({ systemPrompt: e.target.value })}
                  placeholder="You are a helpful assistant…"
                />
              </Field>
              <Field label="User prompt" hint="Use {input}, {context}, {messages} placeholders">
                <textarea
                  className="textarea designer-prompt"
                  rows={5}
                  value={data.userPrompt ?? ''}
                  onChange={(e) => set({ userPrompt: e.target.value })}
                  placeholder="User message: {input}"
                />
              </Field>
              <Field label="Output state key">
                <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
              </Field>
              <Field label="Bound tools" hint="Tool registry IDs available to this LLM">
                <input
                  className="input"
                  value={(data.boundToolIds ?? []).join(', ')}
                  onChange={(e) =>
                    set({
                      boundToolIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="tool_search, tool_calculator"
                />
              </Field>
              <Field label="Bound agents" hint="Agent registry IDs for delegation">
                <input
                  className="input"
                  value={(data.boundAgentIds ?? []).join(', ')}
                  onChange={(e) =>
                    set({
                      boundAgentIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="agent_research"
                />
              </Field>
            </Section>
          </>
        )}

        {data.kind === 'tool' && (
          <Section title="Tool configuration">
            <Field label="Connection type">
              <select
                className="input"
                value={data.connectionType ?? 'inline'}
                onChange={(e) => set({ connectionType: e.target.value as 'inline' | 'registry' | 'mcp' })}
              >
                <option value="inline">Inline definition</option>
                <option value="registry">Tool registry</option>
                <option value="mcp">MCP Studio tool</option>
              </select>
            </Field>
            {(data.connectionType ?? 'inline') === 'registry' && (
              <Field label="Registry entry">
                <select
                  className="input"
                  value={data.toolRegistryId}
                  onChange={(e) => {
                    const tool = (document.toolRegistry ?? []).find((t) => t.id === e.target.value)
                    set({
                      toolRegistryId: e.target.value,
                      toolName: tool?.name ?? data.toolName,
                      toolDescription: tool?.description ?? data.toolDescription,
                    })
                  }}
                >
                  <option value="">Select tool…</option>
                  {(document.toolRegistry ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {(data.connectionType ?? 'inline') === 'mcp' && (
              <>
                <Field label="MCP server">
                  <select
                    className="input"
                    value={data.mcpServerId}
                    onChange={(e) => set({ mcpServerId: e.target.value })}
                  >
                    <option value="">Select server…</option>
                    {(document.mcpServers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="MCP tool">
                  <select
                    className="input"
                    value={data.mcpToolName}
                    onChange={(e) => {
                      const server = (document.mcpServers ?? []).find((s) => s.id === data.mcpServerId)
                      const tool = server?.tools.find((t) => t.name === e.target.value)
                      set({
                        mcpToolName: e.target.value,
                        toolName: tool?.name ?? e.target.value,
                        toolDescription: tool?.description ?? data.toolDescription,
                      })
                    }}
                  >
                    <option value="">Select tool…</option>
                    {(document.mcpServers ?? [])
                      .find((s) => s.id === data.mcpServerId)
                      ?.tools.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Tool name">
              <input className="input" value={data.toolName} onChange={(e) => set({ toolName: e.target.value })} />
            </Field>
            <Field label="Description" hint="Used by the agent to decide when to call this tool">
              <textarea className="textarea" rows={3} value={data.toolDescription} onChange={(e) => set({ toolDescription: e.target.value })} />
            </Field>
            <Field label="Input schema (JSON)">
              <textarea className="textarea code" rows={4} value={data.inputSchema ?? '{}'} onChange={(e) => set({ inputSchema: e.target.value })} />
            </Field>
            <Field label="Read from state key">
              <input className="input" value={data.inputKey} onChange={(e) => set({ inputKey: e.target.value })} />
            </Field>
            <Field label="Write to state key">
              <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
            </Field>
          </Section>
        )}

        {data.kind === 'router' && (
          <>
            <Section title="Decision logic">
              <Field label="Template">
                <select
                  className="input"
                  defaultValue=""
                  onChange={(e) => {
                    const t = ROUTER_TEMPLATES.find((r) => r.id === e.target.value)
                    if (t) set({ routerFn: t.code })
                    e.target.value = ''
                  }}
                >
                  <option value="">Insert router template…</option>
                  {ROUTER_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Router function (Python)" hint="Must return a branch label string">
                <textarea className="textarea code designer-code" rows={10} value={data.routerFn} onChange={(e) => set({ routerFn: e.target.value })} />
              </Field>
            </Section>
            <Section title="Branches">
              <p className="designer-hint">Connect each branch handle on canvas to a target node.</p>
              {data.branches.map((branch, idx) => (
                <div key={branch.id} className="branch-editor">
                  <input
                    className="input"
                    value={branch.label}
                    placeholder="Branch label"
                    onChange={(e) => {
                      const branches = [...data.branches]
                      branches[idx] = { ...branch, label: e.target.value }
                      set({ branches })
                    }}
                  />
                  <input
                    className="input"
                    value={branch.condition}
                    placeholder="Condition note"
                    onChange={(e) => {
                      const branches = [...data.branches]
                      branches[idx] = { ...branch, condition: e.target.value }
                      set({ branches })
                    }}
                  />
                  <button
                    className="btn-danger-sm"
                    type="button"
                    onClick={() => set({ branches: data.branches.filter((b) => b.id !== branch.id) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary-sm"
                type="button"
                onClick={() => {
                  const b: RouterBranch = { id: `b_${Date.now().toString(36)}`, label: 'new_branch', condition: '' }
                  set({ branches: [...data.branches, b] })
                }}
              >
                <Plus size={12} /> Add branch
              </button>
            </Section>
          </>
        )}

        {data.kind === 'function' && (
          <Section title="Python function">
            <Field label="Function name">
              <input className="input" value={data.functionName} onChange={(e) => set({ functionName: e.target.value })} />
            </Field>
            <Field label="Source code" hint="Receives state dict, returns partial state update">
              <textarea className="textarea code designer-code" rows={12} value={data.code} onChange={(e) => set({ code: e.target.value })} />
            </Field>
            <Field label="Output state key">
              <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
            </Field>
          </Section>
        )}

        {data.kind === 'agent' && (
          <Section title="Agent delegation">
            <Field label="Connection type">
              <select
                className="input"
                value={data.connectionType}
                onChange={(e) =>
                  set({ connectionType: e.target.value as typeof data.connectionType })
                }
              >
                <option value="registry">Agent registry</option>
                <option value="subagent">Local sub-agent (subgraph)</option>
                <option value="remote">Remote agent</option>
                <option value="a2a">A2A agent</option>
              </select>
            </Field>
            {data.connectionType === 'registry' && (
              <Field label="Registry entry">
                <select
                  className="input"
                  value={data.agentRegistryId}
                  onChange={(e) => set({ agentRegistryId: e.target.value })}
                >
                  <option value="">Select agent…</option>
                  {(document.agentRegistry ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.kind})</option>
                  ))}
                </select>
              </Field>
            )}
            {data.connectionType === 'subagent' && (
              <Field label="Subgraph" hint="Double-click node to drill in when configured">
                <select className="input" value={data.subgraphId} onChange={(e) => set({ subgraphId: e.target.value })}>
                  <option value="">Select subgraph…</option>
                  {document.subgraphs.map((sg) => (
                    <option key={sg.id} value={sg.id}>{sg.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {data.connectionType === 'remote' && (
              <Field label="Remote agent ID">
                <select
                  className="input"
                  value={data.remoteAgentId}
                  onChange={(e) => set({ remoteAgentId: e.target.value })}
                >
                  <option value="">From agent registry…</option>
                  {(document.agentRegistry ?? [])
                    .filter((a) => a.kind === 'remote')
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
              </Field>
            )}
            {data.connectionType === 'a2a' && (
              <Field label="A2A agent">
                <select
                  className="input"
                  value={data.a2aAgentId}
                  onChange={(e) => set({ a2aAgentId: e.target.value })}
                >
                  <option value="">From agent registry…</option>
                  {(document.agentRegistry ?? [])
                    .filter((a) => a.kind === 'a2a')
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
              </Field>
            )}
            <label className="designer-check">
              <input
                type="checkbox"
                checked={data.delegateTools}
                onChange={(e) => set({ delegateTools: e.target.checked })}
              />
              Delegate bound tools to this agent
            </label>
            <Field label="Input mapping (JSON)">
              <textarea className="textarea code" rows={3} value={data.inputMapping} onChange={(e) => set({ inputMapping: e.target.value })} />
            </Field>
            <Field label="Output mapping (JSON)">
              <textarea className="textarea code" rows={3} value={data.outputMapping} onChange={(e) => set({ outputMapping: e.target.value })} />
            </Field>
          </Section>
        )}

        {data.kind === 'subgraph' && (
          <Section title="Subgraph connector">
            <Field label="Connection type">
              <select
                className="input"
                value={data.connectionType ?? 'local'}
                onChange={(e) =>
                  set({ connectionType: e.target.value as 'local' | 'remote' })
                }
              >
                <option value="local">Local subgraph (nested canvas)</option>
                <option value="remote">Remote graph (HTTP / deployed)</option>
              </select>
            </Field>

            {(data.connectionType ?? 'local') === 'local' ? (
              <Field label="Target subgraph" hint="Double-click node on canvas to drill in">
                <select className="input" value={data.subgraphId} onChange={(e) => set({ subgraphId: e.target.value })}>
                  <option value="">Select subgraph…</option>
                  {document.subgraphs
                    .filter((sg) => sg.id !== document.activeSubgraphId)
                    .map((sg) => (
                      <option key={sg.id} value={sg.id}>{sg.name}</option>
                    ))}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Remote graph registry entry">
                  <select
                    className="input"
                    value={data.remoteGraphId}
                    onChange={(e) => {
                      const ref = (document.remoteGraphs ?? []).find((r) => r.id === e.target.value)
                      set({
                        remoteGraphId: e.target.value,
                        remoteEndpoint: ref?.url ?? data.remoteEndpoint,
                      })
                    }}
                  >
                    <option value="">Select from registry…</option>
                    {(document.remoteGraphs ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Endpoint override" hint="Optional URL override">
                  <input
                    className="input"
                    value={data.remoteEndpoint ?? ''}
                    onChange={(e) => set({ remoteEndpoint: e.target.value })}
                    placeholder="https://api.example.com/graphs/worker"
                  />
                </Field>
              </>
            )}

            <Field label="Input mapping (JSON)" hint="Map parent state → subgraph input">
              <textarea className="textarea code" rows={4} value={data.inputMapping} onChange={(e) => set({ inputMapping: e.target.value })} />
            </Field>
            <Field label="Output mapping (JSON)" hint="Map subgraph output → parent state">
              <textarea className="textarea code" rows={4} value={data.outputMapping} onChange={(e) => set({ outputMapping: e.target.value })} />
            </Field>
          </Section>
        )}

        {(data.kind === 'start' || data.kind === 'end') && (
          <Section title="Terminal node">
            <p className="designer-hint">
              {data.kind === 'start'
                ? 'Entry point maps to LangGraph START. Connect the output handle to your first processing node.'
                : 'Exit point maps to LangGraph END. Connect incoming edges from terminal nodes.'}
            </p>
          </Section>
        )}
      </div>
    </div>
  )
}
