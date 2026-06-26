const API_BASE = import.meta.env.VITE_PLATFORM_API ?? '/api'

export type AuthProvider = 'google' | 'microsoft' | 'linkedin'

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
}

export interface AuthContext {
  enabled: boolean
  providers: AuthProvider[]
  user: AuthUser | null
}

/**
 * Ask the API whether auth is enabled, which providers exist, and who (if
 * anyone) is logged in. If the API is unreachable (e.g. the static GitHub Pages
 * demo) we treat auth as disabled so the app stays usable.
 */
export async function fetchAuthContext(): Promise<AuthContext> {
  try {
    const res = await fetch(`${API_BASE}/auth/context`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return { enabled: false, providers: [], user: null }
    return (await res.json()) as AuthContext
  } catch {
    return { enabled: false, providers: [], user: null }
  }
}

/** Full-page redirect into the provider's consent screen. */
export function startLogin(provider: AuthProvider): void {
  window.location.href = `${API_BASE}/auth/login/${provider}`
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    /* caller refreshes auth state */
  }
}
