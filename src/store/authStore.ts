import { create } from 'zustand'
import {
  type AuthContext,
  type AuthProvider,
  type AuthUser,
  fetchAuthContext,
  logout as apiLogout,
  startLogin,
} from '../lib/api/authClient'

type AuthStatus = 'loading' | 'ready'

interface AuthState {
  status: AuthStatus
  enabled: boolean
  providers: AuthProvider[]
  user: AuthUser | null
  isAdmin: boolean
  /** True when auth is on and nobody is logged in → show the login screen. */
  needsLogin: boolean
  refresh: () => Promise<void>
  login: (provider: AuthProvider) => void
  logout: () => Promise<void>
}

function derive(ctx: AuthContext) {
  return {
    enabled: ctx.enabled,
    providers: ctx.providers,
    user: ctx.user,
    isAdmin: Boolean(ctx.is_admin),
    needsLogin: ctx.enabled && !ctx.user,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  enabled: false,
  providers: [],
  user: null,
  isAdmin: false,
  needsLogin: false,

  refresh: async () => {
    const ctx = await fetchAuthContext()
    set({ status: 'ready', ...derive(ctx) })
  },

  login: (provider) => startLogin(provider),

  logout: async () => {
    await apiLogout()
    const ctx = await fetchAuthContext()
    set({ status: 'ready', ...derive(ctx) })
  },
}))
