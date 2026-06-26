import { Trash2 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { resolveComponent } from '../../lib/customComponents'
import type { ConfigField } from '../../types/component'
import type { CustomNodeData, StitchNodeData } from '../../types/graph'

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

function fieldError(field: ConfigField, value: unknown): string | null {
  const str = value === undefined || value === null ? '' : String(value)
  if (field.required && str.trim() === '') {
    return `${field.label} is required.`
  }
  if (field.kind === 'number' && str !== '') {
    const n = Number(str)
    if (!Number.isFinite(n)) return 'Must be a number.'
    if (typeof field.min === 'number' && n < field.min) return `Must be ≥ ${field.min}.`
    if (typeof field.max === 'number' && n > field.max) return `Must be ≤ ${field.max}.`
  }
  if (field.kind === 'json' && str.trim() !== '') {
    try {
      JSON.parse(str)
    } catch {
      return 'Invalid JSON.'
    }
  }
  if (field.pattern && (field.kind === 'string' || field.kind === 'code') && str !== '') {
    try {
      if (!new RegExp(field.pattern).test(str)) return `Must match pattern: ${field.pattern}`
    } catch {
      /* invalid pattern ignored (warned at manifest level) */
    }
  }
  return null
}

export function ManifestConfigForm({
  nodeId,
  data,
  set,
}: {
  nodeId: string
  data: CustomNodeData
  set: (patch: Partial<StitchNodeData>) => void
}) {
  const registry = useGraphStore((s) => s.document.componentRegistry)
  const removeNode = useGraphStore((s) => s.removeNode)
  const manifest = resolveComponent(registry, data.componentId)

  if (!manifest) {
    return (
      <Section title="Custom component">
        <p className="field-error" data-testid="manifest-config-missing">
          This component was removed from the project. The node will export a stub.
        </p>
        <button type="button" className="btn-danger-sm" onClick={() => removeNode(nodeId)}>
          <Trash2 size={12} /> Delete node
        </button>
      </Section>
    )
  }

  const config = data.config ?? {}
  const setConfig = (fieldId: string, value: unknown) => {
    set({ config: { ...config, [fieldId]: value } })
  }

  return (
    <>
      <Section title={`${manifest.label} configuration`}>
        {manifest.configFields.length === 0 && (
          <p className="designer-hint">This component has no configurable fields.</p>
        )}
        {manifest.configFields.map((field) => {
          const value = config[field.id]
          const error = fieldError(field, value)
          const testId = `manifest-config-field-${field.id}`
          return (
            <Field key={field.id} label={field.label} hint={field.hint}>
              {field.kind === 'string' && (
                <input
                  className="input"
                  data-testid={testId}
                  value={value === undefined ? '' : String(value)}
                  placeholder={field.placeholder}
                  onChange={(e) => setConfig(field.id, e.target.value)}
                />
              )}
              {field.kind === 'number' && (
                <input
                  className="input"
                  type="number"
                  data-testid={testId}
                  min={field.min}
                  max={field.max}
                  value={value === undefined ? '' : String(value)}
                  onChange={(e) => setConfig(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                />
              )}
              {field.kind === 'boolean' && (
                <label className="designer-check">
                  <input
                    type="checkbox"
                    data-testid={testId}
                    checked={Boolean(value)}
                    onChange={(e) => setConfig(field.id, e.target.checked)}
                  />
                  {field.placeholder || 'Enabled'}
                </label>
              )}
              {field.kind === 'select' && (
                <select
                  className="input"
                  data-testid={testId}
                  value={value === undefined ? '' : String(value)}
                  onChange={(e) => setConfig(field.id, e.target.value)}
                >
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {(field.kind === 'code' || field.kind === 'json') && (
                <textarea
                  className="textarea code designer-code"
                  rows={field.kind === 'code' ? 8 : 4}
                  data-testid={testId}
                  value={value === undefined ? '' : String(value)}
                  placeholder={field.placeholder}
                  onChange={(e) => setConfig(field.id, e.target.value)}
                />
              )}
              {field.kind === 'secret' && (
                <input
                  className="input"
                  type="password"
                  data-testid={testId}
                  value={value === undefined ? '' : String(value)}
                  placeholder={field.placeholder || 'ENV_VAR_NAME'}
                  onChange={(e) => setConfig(field.id, e.target.value)}
                />
              )}
              {field.kind === 'secret' && (
                <span className="field-hint">
                  Stored as an environment variable name; exported as os.environ.get(...).
                </span>
              )}
              {error && <span className="field-error">{error}</span>}
            </Field>
          )
        })}
      </Section>

      <Section title="Output">
        <Field label="Output state key" hint="Available to the template as {{outputKey}}">
          <input
            className="input"
            data-testid="manifest-config-output-key"
            value={data.outputKey ?? ''}
            onChange={(e) => set({ outputKey: e.target.value })}
          />
        </Field>
      </Section>
    </>
  )
}
