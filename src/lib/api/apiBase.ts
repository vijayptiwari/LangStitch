/** Resolve the platform API base URL for the current runtime. */
let cachedApiBase: string | null = null

export async function initApiBase(): Promise<string> {
  if (window.langtailor?.getPlatformApiBase) {
    cachedApiBase = (await window.langtailor.getPlatformApiBase()).replace(/\/$/, '')
    return cachedApiBase
  }
  cachedApiBase = resolveApiBase()
  return cachedApiBase
}

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_PLATFORM_API
  if (fromEnv && fromEnv !== '/api' && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, '')
  }
  return '/api'
}

export function getApiBase(): string {
  if (cachedApiBase) return cachedApiBase
  // Desktop preload may not have resolved yet — use the default sidecar port.
  if (window.langtailor?.isElectron) return 'http://127.0.0.1:8787/api'
  return resolveApiBase()
}

export function hasAbsoluteApi(): boolean {
  return /^https?:\/\//i.test(getApiBase())
}

/** Auth headers for marketplace / platform calls (session cookie or desktop bearer). */
export async function apiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = await getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function getAuthToken(): Promise<string | null> {
  if (window.langtailor?.getAuthToken) {
    const res = await window.langtailor.getAuthToken()
    return res?.token ?? null
  }
  try {
    return localStorage.getItem('langtailor-auth-token')
  } catch {
    return null
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (window.langtailor?.setAuthToken) {
    await window.langtailor.setAuthToken(token)
    return
  }
  try {
    if (token) localStorage.setItem('langtailor-auth-token', token)
    else localStorage.removeItem('langtailor-auth-token')
  } catch {
    /* ignore */
  }
}
