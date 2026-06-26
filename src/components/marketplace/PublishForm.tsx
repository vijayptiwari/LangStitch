import { useState } from 'react'
import { Send, Upload } from 'lucide-react'
import { marketplaceApi, type PluginKind, type PublishInput } from '../../lib/api/marketplaceClient'

type ArtifactMode = 'upload' | 'url'

const EMPTY: PublishInput = {
  name: '',
  extension_id: '',
  download_url: '',
  version: '0.1.0',
  kind: 'connector',
  summary: '',
  description: '',
  category: '',
  homepage_url: '',
  repo_url: '',
  purpose: '',
  input_schema: '',
  output_schema: '',
}

export function PublishForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [form, setForm] = useState<PublishInput>(EMPTY)
  const [mode, setMode] = useState<ArtifactMode>('upload')
  const [artifact, setArtifact] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = <K extends keyof PublishInput>(key: K, value: PublishInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'upload' && !artifact) {
      setError('Please choose a .vsix file to upload')
      return
    }
    if (mode === 'url' && !form.download_url?.trim()) {
      setError('Please provide a download URL for your .vsix')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await marketplaceApi.publish({
        ...form,
        name: form.name.trim(),
        extension_id: form.extension_id.trim(),
        download_url: mode === 'url' ? form.download_url?.trim() : undefined,
        artifact: mode === 'upload' ? artifact ?? undefined : undefined,
      })
      setDone(true)
      setForm(EMPTY)
      setArtifact(null)
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mk-publish-done" data-testid="mk-publish-done">
        <h3>Submitted for review</h3>
        <p>
          Thanks! Your connector is now pending review. Our team has been notified and
          you&apos;ll get an email once it&apos;s approved and published.
        </p>
        <button className="mk-acquire" type="button" onClick={() => setDone(false)}>
          Submit another
        </button>
      </div>
    )
  }

  return (
    <form className="mk-publish" onSubmit={submit} data-testid="mk-publish-form">
      {error && <div className="mk-error">{error}</div>}
      <p className="mk-note">
        Submit a connector to share it with the community. It will be reviewed before
        becoming publicly available.
      </p>

      <div className="mk-form-grid">
        <label className="mk-field">
          <span>Name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="mk-field">
          <span>Kind</span>
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as PluginKind)}>
            <option value="connector">Connector</option>
            <option value="plugin">Plugin</option>
          </select>
        </label>
        <label className="mk-field">
          <span>Extension ID * (publisher.name)</span>
          <input
            value={form.extension_id}
            onChange={(e) => set('extension_id', e.target.value)}
            placeholder="acme.my-connector"
            required
          />
        </label>
        <label className="mk-field">
          <span>Version</span>
          <input value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="0.1.0" />
        </label>
      </div>

      <div className="mk-artifact-mode">
        <span className="mk-artifact-label">Artifact *</span>
        <div className="mk-filters">
          <button
            type="button"
            className={`mk-chip ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
            data-testid="mk-artifact-upload"
          >
            <Upload size={13} /> Upload .vsix
          </button>
          <button
            type="button"
            className={`mk-chip ${mode === 'url' ? 'active' : ''}`}
            onClick={() => setMode('url')}
            data-testid="mk-artifact-url"
          >
            External URL
          </button>
        </div>
        {mode === 'upload' ? (
          <label className="mk-field mk-field-block mk-file-input">
            <input
              type="file"
              accept=".vsix,application/vsix,application/zip"
              onChange={(e) => setArtifact(e.target.files?.[0] ?? null)}
              data-testid="mk-vsix-file"
            />
            {artifact ? (
              <span className="mk-file-name">{artifact.name}</span>
            ) : (
              <span className="mk-file-placeholder">Choose a .vsix file (max 50 MB)</span>
            )}
          </label>
        ) : (
          <label className="mk-field mk-field-block">
            <input
              value={form.download_url}
              onChange={(e) => set('download_url', e.target.value)}
              placeholder="https://…/my-connector-0.1.0.vsix"
            />
          </label>
        )}
      </div>

      <div className="mk-form-grid">
        <label className="mk-field">
          <span>Category</span>
          <input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Models, Data…" />
        </label>
        <label className="mk-field">
          <span>Homepage URL</span>
          <input value={form.homepage_url} onChange={(e) => set('homepage_url', e.target.value)} />
        </label>
      </div>

      <label className="mk-field mk-field-block">
        <span>Summary</span>
        <input value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="One-line description" />
      </label>
      <label className="mk-field mk-field-block">
        <span>Description</span>
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label className="mk-field mk-field-block">
        <span>Purpose — what does it do and why?</span>
        <textarea rows={2} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} />
      </label>
      <div className="mk-form-grid">
        <label className="mk-field mk-field-wide">
          <span>Input schema</span>
          <textarea
            rows={4}
            value={form.input_schema}
            onChange={(e) => set('input_schema', e.target.value)}
            placeholder='{ "query": "string" }'
          />
        </label>
        <label className="mk-field mk-field-wide">
          <span>Output schema</span>
          <textarea
            rows={4}
            value={form.output_schema}
            onChange={(e) => set('output_schema', e.target.value)}
            placeholder='{ "results": "array" }'
          />
        </label>
      </div>

      <button className="mk-acquire mk-publish-submit" type="submit" disabled={submitting}>
        <Send size={15} /> {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}
