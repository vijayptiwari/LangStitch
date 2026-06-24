import { IntegrationsPanel } from './IntegrationsPanel'
import { useGraphStore } from '../../store/graphStore'
import type {
  A2aConfig,
  CheckpointerConfig,
  GraphSettings,
  ObservabilityConfig,
  RemoteGraphRef,
  StateFieldType,
} from '../../types/graph'
import { AUDIT_EVENT_OPTIONS, DEFAULT_GRAPH_SETTINGS } from '../../lib/designerConstants'
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

export function GraphDesigner() {
  const document = useGraphStore((s) => s.document)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const navigationPath = useGraphStore((s) => s.navigationPath)
  const setDocumentMeta = useGraphStore((s) => s.setDocumentMeta)
  const updateGraphSettings = useGraphStore((s) => s.updateGraphSettings)
  const addStateField = useGraphStore((s) => s.addStateField)
  const updateStateField = useGraphStore((s) => s.updateStateField)
  const removeStateField = useGraphStore((s) => s.removeStateField)
  const navigateToGraph = useGraphStore((s) => s.navigateToGraph)
  const addRemoteGraph = useGraphStore((s) => s.addRemoteGraph)
  const updateRemoteGraph = useGraphStore((s) => s.updateRemoteGraph)
  const removeRemoteGraph = useGraphStore((s) => s.removeRemoteGraph)

  const settings: GraphSettings = document.settings ?? DEFAULT_GRAPH_SETTINGS
  const lifecycle = settings.lifecycle
  const checkpointer = settings.checkpointer
  const observability = settings.observability
  const evalConfig = settings.eval
  const a2a = settings.a2a
  const remoteGraphs = document.remoteGraphs ?? []

  const stats = {
    nodes: nodes.length,
    edges: edges.length,
    llm: nodes.filter((n) => n.data.kind === 'llm').length,
    decisions: nodes.filter((n) => n.data.kind === 'router').length,
  }

  const patchLifecycle = (patch: Partial<typeof lifecycle>) =>
    updateGraphSettings({ lifecycle: { ...lifecycle, ...patch } })

  const patchCheckpointer = (patch: Partial<CheckpointerConfig>) =>
    updateGraphSettings({ checkpointer: { ...checkpointer, ...patch } })

  const patchObservability = (patch: Partial<ObservabilityConfig>) =>
    updateGraphSettings({ observability: { ...observability, ...patch } })

  const patchA2a = (patch: Partial<A2aConfig>) =>
    updateGraphSettings({ a2a: { ...a2a, ...patch } })

  const handleAddRemote = () => {
    const ref: RemoteGraphRef = {
      id: `remote_${Date.now().toString(36)}`,
      name: 'Remote Graph',
      url: 'https://api.example.com/graphs/worker',
      authEnvVar: 'REMOTE_GRAPH_API_KEY',
      version: '1.0',
    }
    addRemoteGraph(ref)
  }

  return (
    <div className="designer-panel">
      <header className="designer-panel-header graph-header">
        <div className="designer-panel-badge">Graph</div>
        <h3>{document.name}</h3>
        <p className="designer-panel-id">StateGraph blueprint · depth {navigationPath.length}</p>
      </header>

      <div className="designer-scroll">
        <div className="graph-stats">
          <div className="graph-stat"><span>{stats.nodes}</span> nodes</div>
          <div className="graph-stat"><span>{stats.edges}</span> edges</div>
          <div className="graph-stat"><span>{stats.llm}</span> LLM</div>
          <div className="graph-stat"><span>{stats.decisions}</span> decisions</div>
        </div>

        <Section title="Graph identity">
          <Field label="Graph name" hint="Used in export filenames and Python module name">
            <input className="input" value={document.name} onChange={(e) => setDocumentMeta({ name: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea
              className="textarea"
              rows={3}
              value={document.description ?? ''}
              onChange={(e) => setDocumentMeta({ description: e.target.value })}
              placeholder="Describe this workflow for your team…"
            />
          </Field>
          <Field label="Tags" hint="Comma-separated labels for organization">
            <input
              className="input"
              value={settings.tags}
              onChange={(e) => updateGraphSettings({ tags: e.target.value })}
              placeholder="agent, rag, production"
            />
          </Field>
        </Section>

        <Section title="Shared state schema">
          <p className="designer-hint">TypedDict fields passed between all nodes in this graph.</p>
          <div className="state-fields">
            {document.stateFields.map((field) => (
              <div key={field.id} className="state-field-row designer-state-row">
                <input
                  className="input"
                  value={field.name}
                  onChange={(e) => updateStateField(field.id, { name: e.target.value })}
                  placeholder="field_name"
                />
                <select
                  className="input"
                  value={field.type}
                  onChange={(e) => updateStateField(field.id, { type: e.target.value as StateFieldType })}
                >
                  <option value="str">str</option>
                  <option value="int">int</option>
                  <option value="float">float</option>
                  <option value="bool">bool</option>
                  <option value="list">list</option>
                  <option value="dict">dict</option>
                  <option value="messages">messages</option>
                </select>
                <select
                  className="input"
                  value={field.reducer ?? 'replace'}
                  onChange={(e) => updateStateField(field.id, { reducer: e.target.value as 'append' | 'replace' })}
                >
                  <option value="replace">replace</option>
                  <option value="append">append</option>
                </select>
                <button className="btn-danger-sm" type="button" onClick={() => removeStateField(field.id)}>×</button>
              </div>
            ))}
          </div>
          <button
            className="btn-secondary-sm"
            type="button"
            onClick={() =>
              addStateField({
                id: `sf_${Date.now().toString(36)}`,
                name: 'new_field',
                type: 'str',
                reducer: 'replace',
              })
            }
          >
            + Add state field
          </button>
        </Section>

        <Section title="Lifecycle hooks">
          <p className="designer-hint">Python functions invoked on graph runtime startup and shutdown.</p>
          <Field label="On startup" hint="Runs once before first invocation">
            <textarea
              className="textarea code designer-code"
              rows={8}
              value={lifecycle.onStartup}
              onChange={(e) => patchLifecycle({ onStartup: e.target.value })}
            />
          </Field>
          <Field label="On shutdown" hint="Runs when the runtime stops or process exits">
            <textarea
              className="textarea code designer-code"
              rows={8}
              value={lifecycle.onShutdown}
              onChange={(e) => patchLifecycle({ onShutdown: e.target.value })}
            />
          </Field>
        </Section>

        <Section title="Checkpointer manager">
          <p className="designer-hint">Persist and resume graph state across runs.</p>
          <Field label="Manager type">
            <select
              className="input"
              value={checkpointer.manager}
              onChange={(e) => {
                const manager = e.target.value as CheckpointerConfig['manager']
                patchCheckpointer({ manager })
                updateGraphSettings({
                  checkpoint: manager === 'none' ? 'none' : manager === 'postgres' ? 'postgres' : 'memory',
                })
              }}
            >
              <option value="none">None</option>
              <option value="memory">In-memory (MemorySaver)</option>
              <option value="postgres">PostgreSQL</option>
              <option value="sqlite">SQLite</option>
              <option value="redis">Redis</option>
            </select>
          </Field>
          {checkpointer.manager !== 'none' && (
            <>
              <Field label="Connection string" hint="Database or Redis URL">
                <input
                  className="input"
                  value={checkpointer.connectionString}
                  onChange={(e) => patchCheckpointer({ connectionString: e.target.value })}
                />
              </Field>
              <Field label="Table / key prefix">
                <input
                  className="input"
                  value={checkpointer.tablePrefix}
                  onChange={(e) => patchCheckpointer({ tablePrefix: e.target.value })}
                />
              </Field>
              <Field label="TTL (seconds)" hint="Checkpoint expiry for ephemeral runs">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={checkpointer.ttlSeconds}
                  onChange={(e) => patchCheckpointer({ ttlSeconds: Number(e.target.value) })}
                />
              </Field>
            </>
          )}
        </Section>

        <IntegrationsPanel />

        <Section title="Observability & tracing">
          <label className="designer-check">
            <input
              type="checkbox"
              checked={observability.enabled}
              onChange={(e) => patchObservability({ enabled: e.target.checked })}
            />
            Enable tracing & audit emitters
          </label>
          {observability.enabled && (
            <>
              <div className="obs-provider-grid">
                <label className="designer-check">
                  <input
                    type="checkbox"
                    checked={observability.langsmith.enabled}
                    onChange={(e) =>
                      patchObservability({
                        langsmith: { ...observability.langsmith, enabled: e.target.checked },
                      })
                    }
                  />
                  LangSmith
                </label>
                <label className="designer-check">
                  <input
                    type="checkbox"
                    checked={observability.langfuse.enabled}
                    onChange={(e) =>
                      patchObservability({
                        langfuse: { ...observability.langfuse, enabled: e.target.checked },
                      })
                    }
                  />
                  Langfuse
                </label>
              </div>
              {observability.langsmith.enabled && (
                <>
                  <Field label="LangSmith project">
                    <input
                      className="input"
                      value={observability.langsmith.projectName}
                      onChange={(e) =>
                        patchObservability({
                          langsmith: { ...observability.langsmith, projectName: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="LangSmith API key env">
                    <input
                      className="input"
                      value={observability.langsmith.apiKeyEnv}
                      onChange={(e) =>
                        patchObservability({
                          langsmith: { ...observability.langsmith, apiKeyEnv: e.target.value },
                        })
                      }
                    />
                  </Field>
                </>
              )}
              {observability.langfuse.enabled && (
                <>
                  <Field label="Langfuse host">
                    <input
                      className="input"
                      value={observability.langfuse.host}
                      onChange={(e) =>
                        patchObservability({
                          langfuse: { ...observability.langfuse, host: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <div className="registry-card-row">
                    <input
                      className="input"
                      value={observability.langfuse.publicKeyEnv}
                      placeholder="Public key env"
                      onChange={(e) =>
                        patchObservability({
                          langfuse: { ...observability.langfuse, publicKeyEnv: e.target.value },
                        })
                      }
                    />
                    <input
                      className="input"
                      value={observability.langfuse.secretKeyEnv}
                      placeholder="Secret key env"
                      onChange={(e) =>
                        patchObservability({
                          langfuse: { ...observability.langfuse, secretKeyEnv: e.target.value },
                        })
                      }
                    />
                  </div>
                </>
              )}
              <Field label="Audit events" hint="Comma-separated event types">
                <input
                  className="input"
                  value={observability.auditEvents}
                  onChange={(e) => patchObservability({ auditEvents: e.target.value })}
                  list="audit-event-suggestions"
                />
                <datalist id="audit-event-suggestions">
                  {AUDIT_EVENT_OPTIONS.map((ev) => (
                    <option key={ev} value={ev} />
                  ))}
                </datalist>
              </Field>
              <Field label="Custom emitter code">
                <textarea
                  className="textarea code designer-code"
                  rows={8}
                  value={observability.customEmitterCode}
                  onChange={(e) => patchObservability({ customEmitterCode: e.target.value })}
                />
              </Field>
            </>
          )}
        </Section>

        <Section title="Structured logging">
          <label className="designer-check">
            <input
              type="checkbox"
              checked={observability.logging.enabled}
              onChange={(e) =>
                patchObservability({
                  logging: { ...observability.logging, enabled: e.target.checked },
                })
              }
            />
            Enable structured logging
          </label>
          {observability.logging.enabled && (
            <>
              <div className="registry-card-row">
                <select
                  className="input"
                  value={observability.logging.level}
                  onChange={(e) =>
                    patchObservability({
                      logging: {
                        ...observability.logging,
                        level: e.target.value as typeof observability.logging.level,
                      },
                    })
                  }
                >
                  <option value="debug">debug</option>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>
                <select
                  className="input"
                  value={observability.logging.format}
                  onChange={(e) =>
                    patchObservability({
                      logging: {
                        ...observability.logging,
                        format: e.target.value as typeof observability.logging.format,
                      },
                    })
                  }
                >
                  <option value="json">JSON</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <label className="designer-check">
                <input
                  type="checkbox"
                  checked={observability.logging.logToFile}
                  onChange={(e) =>
                    patchObservability({
                      logging: { ...observability.logging, logToFile: e.target.checked },
                    })
                  }
                />
                Write logs to file
              </label>
              {observability.logging.logToFile && (
                <input
                  className="input"
                  value={observability.logging.filePath}
                  onChange={(e) =>
                    patchObservability({
                      logging: { ...observability.logging, filePath: e.target.value },
                    })
                  }
                />
              )}
              <label className="designer-check">
                <input
                  type="checkbox"
                  checked={observability.logging.includeTraceId}
                  onChange={(e) =>
                    patchObservability({
                      logging: { ...observability.logging, includeTraceId: e.target.checked },
                    })
                  }
                />
                Include trace ID in log records
              </label>
              <label className="designer-check">
                <input
                  type="checkbox"
                  checked={observability.logging.includeNodeTiming}
                  onChange={(e) =>
                    patchObservability({
                      logging: { ...observability.logging, includeNodeTiming: e.target.checked },
                    })
                  }
                />
                Log per-node execution timing
              </label>
            </>
          )}
        </Section>

        <Section title="Eval configuration (LangSmith)">
          <p className="designer-hint" data-testid="eval-designer-summary">
            {evalConfig?.enabled && (evalConfig.datasetName || evalConfig.datasetId)
              ? `Dataset: ${evalConfig.datasetName || evalConfig.datasetId}${evalConfig.experimentPrefix ? ` · prefix: ${evalConfig.experimentPrefix}` : ''}`
              : 'No eval dataset configured — use Platform → Eval tab.'}
          </p>
          {evalConfig?.enabled && evalConfig.description && (
            <p className="designer-hint muted">{evalConfig.description}</p>
          )}
        </Section>

        <Section title="A2A (Agent-to-Agent)">
          <p className="designer-hint">Google A2A protocol support for interoperable remote agents.</p>
          <label className="designer-check">
            <input
              type="checkbox"
              checked={a2a.enabled}
              onChange={(e) => patchA2a({ enabled: e.target.checked })}
            />
            Enable A2A client
          </label>
          {a2a.enabled && (
            <>
              <Field label="Default agent card URL">
                <input
                  className="input"
                  value={a2a.agentCardUrl}
                  onChange={(e) => patchA2a({ agentCardUrl: e.target.value })}
                />
              </Field>
              <div className="registry-card-row">
                <input
                  className="input"
                  value={a2a.skillId}
                  placeholder="Skill ID"
                  onChange={(e) => patchA2a({ skillId: e.target.value })}
                />
                <input
                  className="input"
                  value={a2a.protocolVersion}
                  placeholder="Protocol version"
                  onChange={(e) => patchA2a({ protocolVersion: e.target.value })}
                />
              </div>
              <Field label="Auth env var">
                <input
                  className="input"
                  value={a2a.authEnvVar}
                  onChange={(e) => patchA2a({ authEnvVar: e.target.value })}
                />
              </Field>
            </>
          )}
        </Section>

        <Section title="Execution settings">
          <Field label="Interrupt before nodes" hint="Comma-separated node names for human-in-the-loop">
            <input
              className="input"
              value={settings.interruptBefore}
              onChange={(e) => updateGraphSettings({ interruptBefore: e.target.value })}
              placeholder="tools, llm_agent"
            />
          </Field>
          <Field label="Max steps">
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={settings.maxSteps}
              onChange={(e) => updateGraphSettings({ maxSteps: Number(e.target.value) })}
            />
          </Field>
          <label className="designer-check">
            <input
              type="checkbox"
              checked={settings.enableStreaming}
              onChange={(e) => updateGraphSettings({ enableStreaming: e.target.checked })}
            />
            Enable streaming responses
          </label>
        </Section>

        <Section title="Remote graph registry">
          <p className="designer-hint">Connect Subgraph Connector nodes to deployed graphs via URL.</p>
          {remoteGraphs.map((ref) => (
            <div key={ref.id} className="remote-graph-row">
              <input
                className="input"
                value={ref.name}
                placeholder="Name"
                onChange={(e) => updateRemoteGraph(ref.id, { name: e.target.value })}
              />
              <input
                className="input"
                value={ref.url}
                placeholder="https://…"
                onChange={(e) => updateRemoteGraph(ref.id, { url: e.target.value })}
              />
              <input
                className="input"
                value={ref.authEnvVar}
                placeholder="Auth env var"
                onChange={(e) => updateRemoteGraph(ref.id, { authEnvVar: e.target.value })}
              />
              <button className="btn-danger-sm" type="button" onClick={() => removeRemoteGraph(ref.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <button className="btn-secondary-sm" type="button" onClick={handleAddRemote}>
            <Plus size={12} /> Add remote graph
          </button>
        </Section>

        <Section title="Subgraphs">
          <p className="designer-hint">Click to navigate · double-click Subgraph nodes on canvas to drill in.</p>
          <ul className="subgraph-list">
            {document.subgraphs.map((sg) => (
              <li
                key={sg.id}
                className={sg.id === document.activeSubgraphId ? 'active clickable' : 'clickable'}
                onClick={() => navigateToGraph(sg.id)}
                onKeyDown={(e) => e.key === 'Enter' && navigateToGraph(sg.id)}
                role="button"
                tabIndex={0}
              >
                <strong>{sg.name}</strong>
                <span>{sg.parentId ? `child of ${sg.parentId}` : 'root'}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
