import { useCallback, useEffect, useState } from 'react'
import {
  Blocks,
  Check,
  Download,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import {
  marketplaceApi,
  type PluginDetail,
  type PluginKind,
  type PluginSummary,
} from '../../lib/api/marketplaceClient'
import { useAuthStore } from '../../store/authStore'
import { PublishForm } from './PublishForm'
import { SubmissionsList } from './SubmissionsList'
import './marketplace.css'

type Tab = 'browse' | 'mine' | 'publish' | 'submissions' | 'review'
type Filter = 'all' | PluginKind

function KindBadge({ kind }: { kind: PluginKind }) {
  const Icon = kind === 'connector' ? Plug : Blocks
  return (
    <span className={`mk-badge mk-badge-${kind}`}>
      <Icon size={12} /> {kind}
    </span>
  )
}

function PluginIcon({ plugin }: { plugin: PluginSummary }) {
  if (plugin.icon_url) {
    return <img className="mk-icon" src={plugin.icon_url} alt="" referrerPolicy="no-referrer" />
  }
  const Icon = plugin.kind === 'connector' ? Plug : Blocks
  return (
    <span className="mk-icon mk-icon-fallback">
      <Icon size={20} />
    </span>
  )
}

export function MarketplacePortal({
  open,
  onClose,
  standalone = false,
}: {
  open: boolean
  onClose: () => void
  standalone?: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const providers = useAuthStore((s) => s.providers)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const [tab, setTab] = useState<Tab>('browse')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PluginDetail | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (tab !== 'browse' && tab !== 'mine') return
    setLoading(true)
    setError(null)
    try {
      const res =
        tab === 'mine'
          ? await marketplaceApi.myPlugins()
          : await marketplaceApi.browse({
              q: query || undefined,
              kind: filter === 'all' ? undefined : filter,
            })
      setPlugins(res.plugins)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the marketplace')
      setPlugins([])
    } finally {
      setLoading(false)
    }
  }, [tab, filter, query])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selected, onClose])

  const toggleAcquire = useCallback(
    async (plugin: PluginSummary) => {
      setBusySlug(plugin.slug)
      try {
        if (plugin.acquired) await marketplaceApi.release(plugin.slug)
        else await marketplaceApi.acquire(plugin.slug)
        const next = !plugin.acquired
        setPlugins((list) =>
          tab === 'mine' && !next
            ? list.filter((p) => p.slug !== plugin.slug)
            : list.map((p) => (p.slug === plugin.slug ? { ...p, acquired: next } : p)),
        )
        setSelected((sel) => (sel && sel.slug === plugin.slug ? { ...sel, acquired: next } : sel))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusySlug(null)
      }
    },
    [tab],
  )

  const openDetail = useCallback(async (slug: string) => {
    try {
      const res = await marketplaceApi.detail(slug)
      setSelected(res.plugin)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plugin')
    }
  }, [])

  if (!open) return null

  const tabs: { id: Tab; label: string; icon?: typeof Upload; needsUser?: boolean; show: boolean }[] = [
    { id: 'browse', label: 'Browse', show: true },
    { id: 'mine', label: 'My plugins', needsUser: true, show: true },
    { id: 'publish', label: 'Publish', icon: Upload, needsUser: true, show: true },
    { id: 'submissions', label: 'Submissions', needsUser: true, show: true },
    { id: 'review', label: 'Review', icon: ShieldCheck, show: isAdmin },
  ]

  const providerLabels: Record<string, string> = {
    google: 'Google',
    microsoft: 'Microsoft',
    linkedin: 'LinkedIn',
  }

  return (
    <div
      className={`mk-overlay${standalone ? ' mk-standalone' : ''}`}
      role={standalone ? 'main' : 'dialog'}
      aria-label="Plugin marketplace"
      data-testid="marketplace"
    >
      <div className="mk-window">
        <header className="mk-header">
          <div className="mk-header-title">
            <Blocks size={20} className="mk-header-logo" />
            <div>
              <div className="mk-title">Marketplace</div>
              <div className="mk-subtitle">Plugins &amp; connectors for LangStitch</div>
            </div>
          </div>
          <div className="mk-tabs" role="tablist">
            {tabs
              .filter((t) => t.show)
              .map((t) => {
                const Icon = t.icon
                const disabled = t.needsUser && !user
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`mk-tab ${tab === t.id ? 'active' : ''}`}
                    onClick={() => setTab(t.id)}
                    type="button"
                    data-testid={`mk-tab-${t.id}`}
                    disabled={disabled}
                    title={disabled ? 'Sign in to use this' : undefined}
                  >
                    {Icon && <Icon size={13} />} {t.label}
                  </button>
                )
              })}
          </div>
          <div className="mk-header-actions">
            <button className="mk-icon-btn" onClick={() => void load()} title="Refresh" type="button">
              <RefreshCw size={16} className={loading ? 'mk-spin' : ''} />
            </button>
            {standalone ? (
              user ? (
                <div className="mk-user" data-testid="mk-user">
                  {user.avatar_url && (
                    <img className="mk-user-avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
                  )}
                  <span className="mk-user-name">{user.name || user.email}</span>
                  <button
                    className="mk-signout"
                    onClick={() => void logout()}
                    type="button"
                    data-testid="mk-signout"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="mk-signin-group" data-testid="mk-signin-group">
                  {providers.map((p) => (
                    <button
                      key={p}
                      className="mk-signin"
                      onClick={() => login(p)}
                      type="button"
                      data-testid={`mk-signin-${p}`}
                    >
                      Sign in with {providerLabels[p] ?? p}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <button className="mk-icon-btn" onClick={onClose} title="Close (Esc)" type="button" data-testid="mk-close">
                <X size={18} />
              </button>
            )}
          </div>
        </header>

        {tab === 'browse' && (
          <div className="mk-controls">
            <div className="mk-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search plugins and connectors…"
                aria-label="Search marketplace"
                data-testid="mk-search"
              />
            </div>
            <div className="mk-filters">
              {(['all', 'plugin', 'connector'] as Filter[]).map((f) => (
                <button
                  key={f}
                  className={`mk-chip ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                  type="button"
                >
                  {f === 'all' ? 'All' : f === 'connector' ? 'Connectors' : 'Plugins'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mk-body">
          {error && <div className="mk-error" data-testid="mk-error">{error}</div>}
          {tab === 'publish' ? (
            <PublishForm onSubmitted={() => setTab('submissions')} />
          ) : tab === 'submissions' ? (
            <SubmissionsList review={false} />
          ) : tab === 'review' ? (
            <SubmissionsList review />
          ) : (
            <>
              {!user && tab === 'browse' && (
                <div className="mk-note">
                  Sign in to add plugins to your profile — they install automatically in the LangTailor desktop IDE.
                </div>
              )}
              {loading ? (
                <div className="mk-empty">Loading…</div>
              ) : plugins.length === 0 ? (
                <div className="mk-empty" data-testid="mk-empty">
                  {tab === 'mine'
                    ? 'No plugins on your profile yet. Browse the catalog to add some.'
                    : 'No plugins match your search.'}
                </div>
              ) : (
                <div className="mk-grid">
                  {plugins.map((p) => (
                    <article key={p.slug} className="mk-card" data-testid={`mk-card-${p.slug}`}>
                      <button className="mk-card-main" onClick={() => void openDetail(p.slug)} type="button">
                        <PluginIcon plugin={p} />
                        <div className="mk-card-text">
                          <div className="mk-card-name">{p.name}</div>
                          <div className="mk-card-summary">{p.summary}</div>
                          <div className="mk-card-meta">
                            <KindBadge kind={p.kind} />
                            <span className="mk-publisher">{p.publisher}</span>
                            {p.latest_version && <span className="mk-version">v{p.latest_version}</span>}
                          </div>
                        </div>
                      </button>
                      <button
                        className={`mk-acquire ${p.acquired ? 'acquired' : ''}`}
                        onClick={() => void toggleAcquire(p)}
                        disabled={!user || busySlug === p.slug}
                        type="button"
                        data-testid={`mk-acquire-${p.slug}`}
                        title={!user ? 'Sign in to add to your profile' : undefined}
                      >
                        {p.acquired ? (
                          <>
                            <Check size={14} /> Added
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Add
                          </>
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="mk-detail-overlay" onClick={() => setSelected(null)}>
          <aside className="mk-detail" onClick={(e) => e.stopPropagation()} data-testid="mk-detail">
            <button className="mk-icon-btn mk-detail-close" onClick={() => setSelected(null)} type="button">
              <X size={18} />
            </button>
            <div className="mk-detail-head">
              <PluginIcon plugin={selected} />
              <div>
                <h2 className="mk-detail-name">{selected.name}</h2>
                <div className="mk-card-meta">
                  <KindBadge kind={selected.kind} />
                  <span className="mk-publisher">{selected.publisher}</span>
                  {selected.latest_version && <span className="mk-version">v{selected.latest_version}</span>}
                </div>
              </div>
            </div>
            <button
              className={`mk-acquire mk-detail-acquire ${selected.acquired ? 'acquired' : ''}`}
              onClick={() => void toggleAcquire(selected)}
              disabled={!user || busySlug === selected.slug}
              type="button"
            >
              {selected.acquired ? (
                <>
                  <Check size={15} /> On your profile
                </>
              ) : (
                <>
                  <Download size={15} /> Add to profile
                </>
              )}
            </button>
            {selected.description && <p className="mk-detail-desc">{selected.description}</p>}
            <dl className="mk-detail-info">
              <dt>Extension ID</dt>
              <dd><code>{selected.extension_id}</code></dd>
              <dt>Source</dt>
              <dd>{selected.source}</dd>
              {selected.homepage_url && (
                <>
                  <dt>Homepage</dt>
                  <dd>
                    <a href={selected.homepage_url} target="_blank" rel="noreferrer">
                      {selected.homepage_url}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            {selected.versions.length > 0 && (
              <div className="mk-versions">
                <h3>Versions</h3>
                <ul>
                  {selected.versions.map((v) => (
                    <li key={v.version}>
                      <span className="mk-version">v{v.version}</span>
                      {v.changelog && <span className="mk-changelog">{v.changelog}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
