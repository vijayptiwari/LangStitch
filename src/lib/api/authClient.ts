import {
  getApiBase,
  getAuthToken,
  hasAbsoluteApi,
  initApiBase,
  setAuthToken,
  apiAuthHeaders,
} from './apiBase'

export type AuthProvider = 'github' | 'google' | 'microsoft' | 'linkedin'

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

export { getApiBase, hasAbsoluteApi, initApiBase, setAuthToken, apiAuthHeaders }

/**
 * Ask the API whether auth is enabled, which providers exist, and who (if
 * anyone) is logged in. If the API is unreachable we treat auth as disabled so
 * the canvas stays usable.
 */
export async function fetchAuthContext(): Promise<AuthContext> {
  try {
    const res = await fetch(`${getApiBase()}/auth/context`, {
      credentials: 'include',
      headers: await apiAuthHeaders(),
    })
    if (!res.ok) return { enabled: false, providers: [], user: null, is_admin: false }
    return (await res.json()) as AuthContext
  } catch {
    return { enabled: false, providers: [], user: null, is_admin: false }
  }
}

const DESKTOP_CALLBACK = 'langtailor://auth/callback'

/**
 * Begin the OAuth flow.
 *
 * Browser: full-page redirect with session cookie.
 * Desktop: opens the system browser with redirect_uri=langtailor://auth/callback
 * so the API can hand back a bearer token via deep link.
 */
export function startLogin(provider: AuthProvider): void {
  const api = getApiBase()
  const params = new URLSearchParams()

  const langtailor = window.langtailor
  if (langtailor?.isElectron) {
    if (!hasAbsoluteApi()) {
      throw new Error(
        'Platform API is starting… wait a moment and try again. If this persists, ensure Python dependencies are installed and `.env` has GitHub OAuth credentials.',
      )
    }
    params.set('redirect_uri', DESKTOP_CALLBACK)
    const url = `${api}/auth/login/${provider}?${params.toString()}`
    if (langtailor.openExternal) {
      void langtailor.openExternal(url)
    } else {
      throw new Error('Cannot open the sign-in page from the desktop shell.')
    }
    return
  }

  if (typeof window !== 'undefined') {
    params.set('return_to', window.location.origin + window.location.pathname)
  }
  const query = params.toString()
  window.location.href = `${api}/auth/login/${provider}${query ? `?${query}` : ''}`
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBase()}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: await apiAuthHeaders(),
    })
  } finally {
    await setAuthToken(null)
  }
}

export async function applyDesktopToken(token: string | null): Promise<void> {
  await setAuthToken(token)
}

export async function loadStoredToken(): Promise<string | null> {
  return getAuthToken()
}
