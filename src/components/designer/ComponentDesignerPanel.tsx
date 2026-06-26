import { useRef, useState } from 'react'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import { ICON_NAMES, resolveIcon, buildDefaultConfig } from '../../lib/customComponents'
import {
  validateManifest,
  serializeComponent,
  parseComponentFile,
  makeCopyId,
  slugifyId,
} from '../../lib/componentIO'
import { downloadBlob } from '../../lib/api/platformClient'
import { buildRenderContext, renderTemplate } from '../../lib/codegen/templateEngine'
import { slugify } from '../../lib/nodeRegistry'
import type {
  ComponentManifest,
  ComponentPort,
  ConfigField,
  ConfigFieldKind,
} from '../../types/component'

const DEFAULT_TEMPLATE =
  'def {{nodeName}}(state: State) -> dict:\n    """{{description}}"""\n    return {"{{outputKey}}": None}\n'

const FIELD_KINDS: ConfigFieldKind[] = [
  'string',
  'number',
  'boolean',
  'select',
  'code',
  'secret',
  'json',
]

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

function makeNewManifest(existingIds: string[]): ComponentManifest {
  const base = 'custom_component'
  let id = base
  let n = 1
  while (existingIds.includes(id)) {
    id = `${base}_${n++}`
  }
  return {
    schemaVersion: '1.0',
    id,
    label: 'New Component',
    category: 'node',
    description: 'A custom component',
    ports: [
      { id: 'in', label: 'Input', side: 'left', multiplicity: 'single' },
      { id: 'out', label: 'Output', side: 'right', multiplicity: 'single' },
    ],
    configFields: [],
    theme: { color: '#7c89ff', colorLight: '#a5b0ff', icon: 'box', typeLabel: 'Custom' },
    codegen: { template: DEFAULT_TEMPLATE, imports: [], dependencies: [], async: false },
    author: '',
    version: '0.1.0',
  }
}

function optionsToText(field: ConfigField): string {
  return (field.options ?? []).map((o) => `${o.value}|${o.label}`).join('\n')
}

function textToOptions(text: string): ConfigField['options'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split('|')
      return { value: (value ?? '').trim(), label: (label ?? value ?? '').trim() }
    })
}

function ComponentEditor({ manifest }: { manifest: ComponentManifest }) {
  const update = useGraphStore((s) => s.updateComponentManifest)
  const remove = useGraphStore((s) => s.removeComponentManifest)
  const countInstances = useGraphStore((s) => s.countComponentInstances)

  const { errors, warnings } = validateManifest(manifest)
  const PreviewIcon = resolveIcon(manifest.theme.icon)

  const previewCtx = buildRenderContext({
    nodeName: slugify(manifest.id),
    label: manifest.label,
    description: manifest.description,
    outputKey: 'result',
    configFields: manifest.configFields.map((f) => ({ id: f.id, kind: f.kind })),
    config: buildDefaultConfig(manifest),
  })
  const preview = renderTemplate(manifest.codegen.template, previewCtx)

  const setPort = (idx: number, patch: Partial<ComponentPort>) => {
    const ports = manifest.ports.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    update(manifest.id, { ports })
  }
  const setField = (idx: number, patch: Partial<ConfigField>) => {
    const configFields = manifest.configFields.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    update(manifest.id, { configFields })
  }

  const handleExport = () => {
    downloadBlob(
      new Blob([serializeComponent(manifest)], { type: 'application/json' }),
      `${manifest.id}.component.json`,
    )
  }

  const handleDelete = () => {
    const count = countInstances(manifest.id)
    const suffix = count > 0 ? ` ${count} placed instance(s) will render as "missing component".` : ''
    if (window.confirm(`Delete component "${manifest.label}"?${suffix}`)) {
      remove(manifest.id)
    }
  }

  return (
    <Section title={manifest.label || manifest.id}>
      <Field label="Component id" hint="Immutable slug, referenced by placed nodes">
        <input className="input" data-testid={`component-id-${manifest.id}`} value={manifest.id} readOnly />
      </Field>
      <Field label="Label">
        <input
          className="input"
          data-testid={`component-label-${manifest.id}`}
          value={manifest.label}
          onChange={(e) => update(manifest.id, { label: e.target.value })}
        />
      </Field>
      <Field label="Category">
        <select
          className="input"
          data-testid={`component-category-${manifest.id}`}
          value={manifest.category}
          onChange={(e) => update(manifest.id, { category: e.target.value as ComponentManifest['category'] })}
        >
          <option value="node">Node</option>
          <option value="connector">Connector</option>
          <option value="adaptor">Adaptor</option>
        </select>
      </Field>
      <Field label="Description">
        <textarea
          className="textarea"
          rows={2}
          value={manifest.description}
          onChange={(e) => update(manifest.id, { description: e.target.value })}
        />
      </Field>
      <Field label="Author / version">
        <div className="field-row">
          <input
            className="input"
            placeholder="author"
            value={manifest.author ?? ''}
            onChange={(e) => update(manifest.id, { author: e.target.value })}
          />
          <input
            className="input"
            placeholder="0.1.0"
            value={manifest.version ?? ''}
            onChange={(e) => update(manifest.id, { version: e.target.value })}
          />
        </div>
      </Field>

      <h4 className="designer-section-title">Theme</h4>
      <Field label="Icon">
        <select
          className="input"
          value={manifest.theme.icon}
          onChange={(e) => update(manifest.id, { theme: { ...manifest.theme, icon: e.target.value } })}
        >
          {ICON_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type label (badge)">
        <input
          className="input"
          value={manifest.theme.typeLabel}
          onChange={(e) => update(manifest.id, { theme: { ...manifest.theme, typeLabel: e.target.value } })}
        />
      </Field>
      <Field label="Color / light">
        <div className="field-row">
          <input
            className="input"
            type="color"
            value={manifest.theme.color}
            onChange={(e) => update(manifest.id, { theme: { ...manifest.theme, color: e.target.value } })}
          />
          <input
            className="input"
            type="color"
            value={manifest.theme.colorLight}
            onChange={(e) => update(manifest.id, { theme: { ...manifest.theme, colorLight: e.target.value } })}
          />
        </div>
      </Field>
      <div
        className="palette-item"
        style={{ '--palette-accent': manifest.theme.color, '--palette-bg': `${manifest.theme.color}22` } as React.CSSProperties}
      >
        <div className="palette-item-icon">
          <PreviewIcon size={18} strokeWidth={2.25} />
        </div>
        <div>
          <div className="palette-item-label">{manifest.label}</div>
          <div className="palette-item-desc">{manifest.theme.typeLabel}</div>
        </div>
      </div>

      <h4 className="designer-section-title">Ports</h4>
      {manifest.ports.map((port, idx) => (
        <div key={idx} className="branch-editor">
          <input
            className="input"
            value={port.id}
            placeholder="id"
            onChange={(e) => setPort(idx, { id: slugifyId(e.target.value, 'port') })}
          />
          <input
            className="input"
            value={port.label}
            placeholder="label"
            onChange={(e) => setPort(idx, { label: e.target.value })}
          />
          <select className="input" value={port.side} onChange={(e) => setPort(idx, { side: e.target.value as ComponentPort['side'] })}>
            <option value="left">Input (left)</option>
            <option value="right">Output (right)</option>
          </select>
          <button
            type="button"
            className="btn-danger-sm"
            onClick={() => update(manifest.id, { ports: manifest.ports.filter((_, i) => i !== idx) })}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary-sm"
        data-testid="component-add-port"
        onClick={() =>
          update(manifest.id, {
            ports: [
              ...manifest.ports,
              { id: `port_${manifest.ports.length + 1}`, label: 'Port', side: 'right', multiplicity: 'single' },
            ],
          })
        }
      >
        <Plus size={12} /> Add port
      </button>

      <h4 className="designer-section-title">Config fields</h4>
      {manifest.configFields.map((field, idx) => (
        <div key={idx} className="designer-section">
          <div className="branch-editor">
            <input
              className="input"
              value={field.id}
              placeholder="id"
              onChange={(e) => setField(idx, { id: slugifyId(e.target.value, 'field') })}
            />
            <input
              className="input"
              value={field.label}
              placeholder="label"
              onChange={(e) => setField(idx, { label: e.target.value })}
            />
            <select className="input" value={field.kind} onChange={(e) => setField(idx, { kind: e.target.value as ConfigFieldKind })}>
              {FIELD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-danger-sm"
              onClick={() => update(manifest.id, { configFields: manifest.configFields.filter((_, i) => i !== idx) })}
            >
              ×
            </button>
          </div>
          <label className="designer-check">
            <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => setField(idx, { required: e.target.checked })} />
            Required
          </label>
          {field.kind === 'select' && (
            <Field label="Options" hint="One per line: value|label">
              <textarea
                className="textarea code"
                rows={3}
                value={optionsToText(field)}
                onChange={(e) => setField(idx, { options: textToOptions(e.target.value) })}
              />
            </Field>
          )}
          <Field label="Hint">
            <input className="input" value={field.hint ?? ''} onChange={(e) => setField(idx, { hint: e.target.value })} />
          </Field>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary-sm"
        data-testid="component-add-field"
        onClick={() =>
          update(manifest.id, {
            configFields: [
              ...manifest.configFields,
              { id: `field_${manifest.configFields.length + 1}`, label: 'Field', kind: 'string' },
            ],
          })
        }
      >
        <Plus size={12} /> Add field
      </button>

      <h4 className="designer-section-title">Codegen</h4>
      <p className="designer-hint">
        Placeholders: {'{{nodeName}} {{label}} {{description}} {{outputKey}} {{field.<id>}} {{field.<id>.raw}}'}
      </p>
      <Field label="Python template" hint="Must define def {{nodeName}}(state: State) -> dict:">
        <textarea
          className="textarea code designer-code"
          rows={10}
          data-testid={`component-template-${manifest.id}`}
          value={manifest.codegen.template}
          onChange={(e) => update(manifest.id, { codegen: { ...manifest.codegen, template: e.target.value } })}
        />
      </Field>
      <Field label="Imports" hint="One python import per line; hoisted + deduped">
        <textarea
          className="textarea code"
          rows={2}
          value={(manifest.codegen.imports ?? []).join('\n')}
          onChange={(e) =>
            update(manifest.id, {
              codegen: { ...manifest.codegen, imports: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) },
            })
          }
        />
      </Field>
      <Field label="Dependencies" hint="Comma-separated pip names (recorded only in MVP)">
        <input
          className="input"
          value={(manifest.codegen.dependencies ?? []).join(', ')}
          onChange={(e) =>
            update(manifest.id, {
              codegen: { ...manifest.codegen, dependencies: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) },
            })
          }
        />
      </Field>
      <label className="designer-check">
        <input
          type="checkbox"
          checked={Boolean(manifest.codegen.async)}
          onChange={(e) => update(manifest.id, { codegen: { ...manifest.codegen, async: e.target.checked } })}
        />
        Emit async def
      </label>

      <h4 className="designer-section-title">Preview generated Python</h4>
      <pre className="textarea code" data-testid="component-preview-python" style={{ whiteSpace: 'pre-wrap' }}>
        {preview.code}
      </pre>
      {preview.errors.length > 0 && (
        <p className="field-error">{preview.errors.join(' · ')}</p>
      )}

      {errors.length > 0 && (
        <p className="field-error" data-testid="component-validation-error">
          {errors.join(' · ')}
        </p>
      )}
      {warnings.length > 0 && <p className="designer-hint">⚠ {warnings.join(' · ')}</p>}

      <div className="field-row">
        <button type="button" className="btn-secondary-sm" data-testid={`component-export-${manifest.id}`} onClick={handleExport}>
          <Download size={12} /> Export .component.json
        </button>
        <button type="button" className="btn-danger-sm" data-testid={`component-remove-${manifest.id}`} onClick={handleDelete}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </Section>
  )
}

interface PendingImport {
  manifest: ComponentManifest
  collision: boolean
}

export function ComponentDesignerPanel() {
  const registry = useGraphStore((s) => s.document.componentRegistry) ?? []
  const addComponentManifest = useGraphStore((s) => s.addComponentManifest)
  const updateComponentManifest = useGraphStore((s) => s.updateComponentManifest)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const existingIds = registry.map((m) => m.id)

  const handleAdd = () => {
    addComponentManifest(makeNewManifest(existingIds))
  }

  const handleFile = async (file: File) => {
    setImportError(null)
    const text = await file.text()
    const result = parseComponentFile(text)
    if (!result.manifest) {
      setImportError(result.errors.join(' · '))
      return
    }
    const collision = existingIds.includes(result.manifest.id)
    setPending({ manifest: result.manifest, collision })
    if (!collision) {
      addComponentManifest(result.manifest)
      setPending(null)
    }
  }

  const resolveCollision = (mode: 'replace' | 'copy') => {
    if (!pending) return
    if (mode === 'replace') {
      updateComponentManifest(pending.manifest.id, pending.manifest)
    } else {
      const copyId = makeCopyId(pending.manifest.id, existingIds)
      addComponentManifest({ ...pending.manifest, id: copyId, label: `${pending.manifest.label} (copy)` })
    }
    setPending(null)
  }

  return (
    <div className="designer-panel" data-testid="component-designer">
      <header className="designer-panel-header">
        <div className="designer-panel-badge">Components</div>
        <h3>SDK Component Designer</h3>
        <p className="designer-panel-id">Author reusable custom nodes, connectors & adaptors</p>
      </header>

      <div className="designer-scroll">
        <div className="field-row">
          <button type="button" className="btn-secondary-sm" data-testid="component-add" onClick={handleAdd}>
            <Plus size={12} /> New component
          </button>
          <button type="button" className="btn-secondary-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.component.json,application/json"
            hidden
            data-testid="component-import-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </div>

        {importError && <p className="field-error">{importError}</p>}

        {pending?.collision && (
          <div className="designer-section" data-testid="component-collision-dialog">
            <p className="field-error">
              A component with id "{pending.manifest.id}" already exists.
            </p>
            <div className="field-row">
              <button type="button" className="btn-secondary-sm" data-testid="component-collision-copy" onClick={() => resolveCollision('copy')}>
                Import as copy
              </button>
              <button type="button" className="btn-danger-sm" data-testid="component-collision-replace" onClick={() => resolveCollision('replace')}>
                Replace
              </button>
              <button type="button" className="btn-secondary-sm" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {registry.length === 0 && (
          <div className="designer-empty" data-testid="component-empty-hint">
            <div className="designer-empty-icon">◈</div>
            <h3>No custom components yet</h3>
            <p>Build a reusable node, connector, or adaptor. It appears in the palette and exports to Python.</p>
          </div>
        )}

        {registry.map((manifest) => (
          <ComponentEditor key={manifest.id} manifest={manifest} />
        ))}
      </div>
    </div>
  )
}
