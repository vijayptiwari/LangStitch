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
  is_admin?: boolean
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
    if (!res.ok) return { enabled: false, providers: [], user: null, is_admin: false }
    return (await res.json()) as AuthContext
  } catch {
    return { enabled: false, providers: [], user: null, is_admin: false }
  }
}

/** Full-page redirect into the provider's consent screen. */
export function startLogin(provider: AuthProvider): void {
  const params = new URLSearchParams()
  if (typeof window !== 'undefined') {
    // Return to whichever site (IDE or marketplace) the login started from.
    params.set('return_to', window.location.origin + window.location.pathname)
  }
  const query = params.toString()
  window.location.href = `${API_BASE}/auth/login/${provider}${query ? `?${query}` : ''}`
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
