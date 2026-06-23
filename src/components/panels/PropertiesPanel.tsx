import { useGraphStore } from '../../store/graphStore'
import type { LGNodeData, StateFieldType } from '../../types/graph'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function PropertiesPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const removeNode = useGraphStore((s) => s.removeNode)
  const document = useGraphStore((s) => s.document)

  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <div className="panel">
        <h3 className="panel-title">Properties</h3>
        <p className="panel-subtitle">Select a node to edit its configuration</p>
      </div>
    )
  }

  const data = node.data

  const set = (patch: Partial<LGNodeData>) => updateNodeData(node.id, patch)

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h3 className="panel-title">Properties</h3>
        {data.kind !== 'start' && data.kind !== 'end' && (
          <button className="btn-danger-sm" onClick={() => removeNode(node.id)} type="button">
            Delete
          </button>
        )}
      </div>
      <p className="panel-subtitle">{data.kind} node · {node.id}</p>

      <Field label="Label">
        <input
          className="input"
          value={data.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </Field>

      {data.kind === 'llm' && (
        <>
          <Field label="Model">
            <input className="input" value={data.model} onChange={(e) => set({ model: e.target.value })} />
          </Field>
          <Field label="System prompt">
            <textarea
              className="textarea"
              rows={4}
              value={data.systemPrompt}
              onChange={(e) => set({ systemPrompt: e.target.value })}
            />
          </Field>
          <Field label="Temperature">
            <input
              className="input"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={data.temperature}
              onChange={(e) => set({ temperature: Number(e.target.value) })}
            />
          </Field>
          <Field label="Output key">
            <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
          </Field>
        </>
      )}

      {data.kind === 'tool' && (
        <>
          <Field label="Tool name">
            <input className="input" value={data.toolName} onChange={(e) => set({ toolName: e.target.value })} />
          </Field>
          <Field label="Description">
            <input
              className="input"
              value={data.toolDescription}
              onChange={(e) => set({ toolDescription: e.target.value })}
            />
          </Field>
          <Field label="Input key">
            <input className="input" value={data.inputKey} onChange={(e) => set({ inputKey: e.target.value })} />
          </Field>
          <Field label="Output key">
            <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
          </Field>
        </>
      )}

      {data.kind === 'function' && (
        <>
          <Field label="Function name">
            <input
              className="input"
              value={data.functionName}
              onChange={(e) => set({ functionName: e.target.value })}
            />
          </Field>
          <Field label="Python code">
            <textarea
              className="textarea code"
              rows={8}
              value={data.code}
              onChange={(e) => set({ code: e.target.value })}
            />
          </Field>
          <Field label="Output key">
            <input className="input" value={data.outputKey} onChange={(e) => set({ outputKey: e.target.value })} />
          </Field>
        </>
      )}

      {data.kind === 'router' && (
        <>
          <Field label="Router function">
            <textarea
              className="textarea code"
              rows={6}
              value={data.routerFn}
              onChange={(e) => set({ routerFn: e.target.value })}
            />
          </Field>
          <div className="branch-list">
            {data.branches.map((branch, idx) => (
              <div key={branch.id} className="branch-item">
                <input
                  className="input"
                  value={branch.label}
                  onChange={(e) => {
                    const branches = [...data.branches]
                    branches[idx] = { ...branch, label: e.target.value }
                    set({ branches })
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {data.kind === 'subgraph' && (
        <>
          <Field label="Subgraph">
            <select
              className="input"
              value={data.subgraphId}
              onChange={(e) => set({ subgraphId: e.target.value })}
            >
              <option value="">Select subgraph…</option>
              {document.subgraphs.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Input mapping (JSON)">
            <textarea
              className="textarea code"
              rows={3}
              value={data.inputMapping}
              onChange={(e) => set({ inputMapping: e.target.value })}
            />
          </Field>
          <Field label="Output mapping (JSON)">
            <textarea
              className="textarea code"
              rows={3}
              value={data.outputMapping}
              onChange={(e) => set({ outputMapping: e.target.value })}
            />
          </Field>
        </>
      )}
    </div>
  )
}

export function StateSchemaPanel() {
  const document = useGraphStore((s) => s.document)
  const addStateField = useGraphStore((s) => s.addStateField)
  const updateStateField = useGraphStore((s) => s.updateStateField)
  const removeStateField = useGraphStore((s) => s.removeStateField)

  const addField = () => {
    addStateField({
      id: `sf_${Date.now().toString(36)}`,
      name: 'new_field',
      type: 'str',
      reducer: 'replace',
    })
  }

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h3 className="panel-title">State Schema</h3>
        <button className="btn-secondary-sm" onClick={addField} type="button">
          + Field
        </button>
      </div>
      <p className="panel-subtitle">TypedDict fields for StateGraph</p>
      <div className="state-fields">
        {document.stateFields.map((field) => (
          <div key={field.id} className="state-field-row">
            <input
              className="input"
              value={field.name}
              onChange={(e) => updateStateField(field.id, { name: e.target.value })}
            />
            <select
              className="input"
              value={field.type}
              onChange={(e) =>
                updateStateField(field.id, { type: e.target.value as StateFieldType })
              }
            >
              <option value="str">str</option>
              <option value="int">int</option>
              <option value="float">float</option>
              <option value="bool">bool</option>
              <option value="list">list</option>
              <option value="dict">dict</option>
              <option value="messages">messages</option>
            </select>
            <button
              className="btn-danger-sm"
              onClick={() => removeStateField(field.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
