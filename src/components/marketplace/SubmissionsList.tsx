import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { marketplaceApi, type Submission, type SubmissionStatus } from '../../lib/api/marketplaceClient'

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`mk-status mk-status-${status}`}>{status}</span>
}

function SubmissionCard({
  sub,
  review,
  onDecision,
}: {
  sub: Submission
  review: boolean
  onDecision?: (slug: string, approve: boolean, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (approve: boolean) => {
    if (!onDecision) return
    setBusy(true)
    try {
      await onDecision(sub.slug, approve, notes)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="mk-sub-card" data-testid={`mk-sub-${sub.slug}`}>
      <div className="mk-sub-head">
        <div>
          <div className="mk-card-name">{sub.name}</div>
          <div className="mk-card-meta">
            <span className={`mk-badge mk-badge-${sub.kind}`}>{sub.kind}</span>
            {sub.version && <span className="mk-version">v{sub.version}</span>}
            <code>{sub.extension_id}</code>
          </div>
        </div>
        <StatusBadge status={sub.status} />
      </div>

      {sub.summary && <p className="mk-sub-summary">{sub.summary}</p>}

      <dl className="mk-sub-info">
        {review && sub.submitter_email && (
          <>
            <dt>Submitter</dt>
            <dd>
              {sub.submitter_name} &lt;{sub.submitter_email}&gt;
            </dd>
          </>
        )}
        {sub.purpose && (
          <>
            <dt>Purpose</dt>
            <dd>{sub.purpose}</dd>
          </>
        )}
        {sub.input_schema && (
          <>
            <dt>Input</dt>
            <dd><pre>{sub.input_schema}</pre></dd>
          </>
        )}
        {sub.output_schema && (
          <>
            <dt>Output</dt>
            <dd><pre>{sub.output_schema}</pre></dd>
          </>
        )}
        {sub.download_url && (
          <>
            <dt>Artifact</dt>
            <dd className="mk-truncate">{sub.download_url}</dd>
          </>
        )}
        {sub.review_notes && (
          <>
            <dt>Notes</dt>
            <dd>{sub.review_notes}</dd>
          </>
        )}
      </dl>

      {review && sub.status === 'pending' && (
        <div className="mk-review-actions">
          <input
            className="mk-review-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional review notes…"
          />
          <button
            className="mk-review-btn approve"
            type="button"
            disabled={busy}
            onClick={() => void act(true)}
            data-testid={`mk-approve-${sub.slug}`}
          >
            <Check size={14} /> Approve
          </button>
          <button
            className="mk-review-btn reject"
            type="button"
            disabled={busy}
            onClick={() => void act(false)}
            data-testid={`mk-reject-${sub.slug}`}
          >
            <X size={14} /> Reject
          </button>
        </div>
      )}
    </article>
  )
}

export function SubmissionsList({ review }: { review: boolean }) {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = review
        ? await marketplaceApi.listSubmissions('pending')
        : await marketplaceApi.mySubmissions()
      setSubs(res.submissions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [review])

  useEffect(() => {
    void load()
  }, [load])

  const onDecision = useCallback(
    async (slug: string, approve: boolean, notes: string) => {
      try {
        if (approve) await marketplaceApi.approve(slug, notes || undefined)
        else await marketplaceApi.reject(slug, notes || undefined)
        setSubs((list) => list.filter((s) => s.slug !== slug))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      }
    },
    [],
  )

  if (loading) return <div className="mk-empty">Loading…</div>
  if (error) return <div className="mk-error">{error}</div>
  if (subs.length === 0) {
    return (
      <div className="mk-empty" data-testid="mk-subs-empty">
        {review ? 'No submissions awaiting review.' : 'You have no submissions yet.'}
      </div>
    )
  }

  return (
    <div className="mk-sub-list">
      {subs.map((s) => (
        <SubmissionCard key={s.slug} sub={s} review={review} onDecision={review ? onDecision : undefined} />
      ))}
    </div>
  )
}
