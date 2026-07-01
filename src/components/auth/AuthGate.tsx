import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import { initApiBase, applyDesktopToken } from '../../lib/api/authClient'
import './auth.css'

/**
 * Resolves auth state on mount. In the desktop IDE we also listen for OAuth
 * deep-link callbacks (langtailor://auth/callback?token=…) and refresh auth
 * when the user returns from GitHub sign-in in the system browser.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    void (async () => {
      await initApiBase()
      await refresh()
    })()

    const api = window.langtailor
    const offToken = api?.onAuthToken?.((token) => {
      void (async () => {
        await applyDesktopToken(token)
        await refresh()
      })()
    })
    const offError = api?.onAuthError?.((err) => {
      useAuthStore.getState().setAuthError(`Sign-in failed (${err}). Try again.`)
    })

    return () => {
      offToken?.()
      offError?.()
    }
  }, [refresh])

  return <>{children}</>
}
