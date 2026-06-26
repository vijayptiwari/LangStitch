import { useEffect, type ReactNode } from 'react'
import type { AuthProvider } from '../../lib/api/authClient'
import { useAuthStore } from '../../store/authStore'
import './auth.css'

const PROVIDER_META: Record<AuthProvider, { label: string; icon: ReactNode }> = {
  google: {
    label: 'Continue with Google',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
      </svg>
    ),
  },
  microsoft: {
    label: 'Continue with Microsoft',
    icon: (
      <svg viewBox="0 0 23 23" width="18" height="18" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M12 1h10v10H12z" />
        <path fill="#00A4EF" d="M1 12h10v10H1z" />
        <path fill="#FFB900" d="M12 12h10v10H12z" />
      </svg>
    ),
  },
  linkedin: {
    label: 'Continue with LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="#0A66C2"
          d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"
        />
      </svg>
    ),
  },
}

export function LoginScreen() {
  const providers = useAuthStore((s) => s.providers)
  const login = useAuthStore((s) => s.login)

  const authError = new URLSearchParams(window.location.search).get('auth_error')

  useEffect(() => {
    if (authError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [authError])

  return (
    <div className="login-screen" data-testid="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">⬡</span>
          <span className="login-title">LangStitch</span>
        </div>
        <h1 className="login-heading">Sign in to your workspace</h1>
        <p className="login-sub">
          Use your work or personal account to access your projects and the visual
          LangGraph IDE.
        </p>

        {authError && (
          <div className="login-error" role="alert" data-testid="login-error">
            Sign-in with {authError} failed. Please try again.
          </div>
        )}

        <div className="login-providers">
          {providers.length === 0 && (
            <p className="login-empty">
              No sign-in providers are configured. Set the OAuth credentials in the
              server environment.
            </p>
          )}
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider]
            if (!meta) return null
            return (
              <button
                key={provider}
                type="button"
                className="login-provider-btn"
                data-testid={`login-${provider}`}
                onClick={() => login(provider)}
              >
                {meta.icon}
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>

        <p className="login-legal">
          By continuing you agree to use LangStitch responsibly.
        </p>
      </div>
    </div>
  )
}
