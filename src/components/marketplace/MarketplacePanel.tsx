import { useCallback, useEffect, useState } from 'react'
import { Blocks, Check, Download, Plug, RefreshCw, Search, Store } from 'lucide-react'
import {
  marketplaceApi,
  type PluginKind,
  type PluginSummary,
} from '../../lib/api/marketplaceClient'
import { useAuthStore } from '../../store/authStore'

type Filter = 'all' | PluginKind

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function PluginIcon({ plugin }: { plugin: PluginSummary }) {
  if (plugin.icon_url) {
    return <img className="mkp-icon" src={plugin.icon_url} alt="" referrerPolicy="no-referrer" />
  }
  const Icon = plugin.kind === 'connector' ? Plug : Blocks
  return (
    <span className="mkp-icon mkp-icon-fallback">
      <Icon size={18} />
    </span>
  )
}

export function MarketplacePanel() {
  const user = useAuthStore((s) => s.user)
  const providers = useAuthStore((s) => s.providers)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const authError = useAuthStore((s) => s.authError)

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await marketplaceApi.browse({
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
  }, [user, query, filter])

  useEffect(() => {
    void load()
  }, [load])

  const install = useCallback(
    async (plugin: PluginSummary) => {
      setBusySlug(plugin.slug)
      try {
        if (plugin.acquired) await marketplaceApi.release(plugin.slug)
        else await marketplaceApi.acquire(plugin.slug)
        const next = !plugin.acquired
        setPlugins((list) =>
          list.map((p) => (p.slug === plugin.slug ? { ...p, acquired: next } : p)),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusySlug(null)
      }
    },
    [],
  )

  // ── Login gate ───────────────────────────────────────────────
  if (!user) {
    const otherProviders = providers.filter((p) => p !== 'github')
    return (
      <div className="mkp-panel mkp-login" data-testid="marketplace-panel">
        <div className="mkp-login-card">
          <Store size={34} className="mkp-login-logo" />
          <h2 className="mkp-login-title">LangTailor Marketplace</h2>
          <p className="mkp-login-sub">
            Sign in to browse and install plugins &amp; connectors. GitHub opens in
            your browser; when done, return here — you&apos;ll be signed in automatically.
          </p>
          <button
            type="button"
            className="mkp-github-btn"
            data-testid="marketplace-login-github"
            onClick={() => login('github')}
          >
            <GithubMark /> Sign in with GitHub
          </button>
          {otherProviders.map((p) => (
            <button
              key={p}
              type="button"
              className="mkp-alt-btn"
              onClick={() => login(p)}
            >
              Continue with {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
          {(authError || error) && (
            <div className="mkp-error mkp-login-error">{authError || error}</div>
          )}
        </div>
      </div>
    )
  }

  // ── Browse + install ─────────────────────────────────────────
  return (
    <div className="mkp-panel" data-testid="marketplace-panel">
      <header className="mkp-header">
        <div className="mkp-header-title">
          <Store size={16} />
          <span>Marketplace</span>
        </div>
        <button
          type="button"
          className="mkp-refresh"
          title="Refresh"
          onClick={() => void load()}
        >
          <RefreshCw size={14} className={loading ? 'mkp-spin' : ''} />
        </button>
      </header>

      <div className="mkp-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plugins & connectors…"
          aria-label="Search marketplace"
          data-testid="marketplace-search"
        />
      </div>

      <div className="mkp-filters">
        {(['all', 'plugin', 'connector'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`mkp-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'connector' ? 'Connectors' : 'Plugins'}
          </button>
        ))}
      </div>

      <div className="mkp-list" data-testid="marketplace-list">
        {error ? (
          <div className="mkp-error">{error}</div>
        ) : loading ? (
          <div className="mkp-empty">Loading…</div>
        ) : plugins.length === 0 ? (
          <div className="mkp-empty">No plugins match your search.</div>
        ) : (
          plugins.map((p) => (
            <article key={p.slug} className="mkp-card" data-testid={`marketplace-card-${p.slug}`}>
              <PluginIcon plugin={p} />
              <div className="mkp-card-text">
                <div className="mkp-card-name">{p.name}</div>
                {p.summary && <div className="mkp-card-summary">{p.summary}</div>}
                <div className="mkp-card-meta">
                  <span className={`mkp-tag ${p.kind}`}>{p.kind}</span>
                  <span className="mkp-publisher">{p.publisher}</span>
                  {p.latest_version && <span className="mkp-version">v{p.latest_version}</span>}
                </div>
              </div>
              <button
                type="button"
                className={`mkp-install ${p.acquired ? 'installed' : ''}`}
                onClick={() => void install(p)}
                disabled={busySlug === p.slug}
                data-testid={`marketplace-install-${p.slug}`}
              >
                {p.acquired ? (
                  <>
                    <Check size={13} /> Installed
                  </>
                ) : (
                  <>
                    <Download size={13} /> Install
                  </>
                )}
              </button>
            </article>
          ))
        )}
      </div>

      <footer className="mkp-footer">
        {user.avatar_url && (
          <img className="mkp-user-avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
        )}
        <span className="mkp-user-name">{user.name || user.email}</span>
        <button type="button" className="mkp-signout" onClick={() => void logout()}>
          Sign out
        </button>
      </footer>
    </div>
  )
}
