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
  needsLogin: boolean
  authError: string | null
  refresh: () => Promise<void>
  login: (provider: AuthProvider) => void
  logout: () => Promise<void>
  setAuthError: (message: string | null) => void
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
  authError: null,

  refresh: async () => {
    const ctx = await fetchAuthContext()
    set({ status: 'ready', authError: null, ...derive(ctx) })
  },

  login: (provider) => {
    set({ authError: null })
    try {
      startLogin(provider)
    } catch (e) {
      set({
        authError: e instanceof Error ? e.message : 'Sign-in is unavailable',
      })
    }
  },

  logout: async () => {
    await apiLogout()
    const ctx = await fetchAuthContext()
    set({ status: 'ready', authError: null, ...derive(ctx) })
  },

  setAuthError: (message) => set({ authError: message }),
}))
