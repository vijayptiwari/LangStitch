import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import { LoginScreen } from './LoginScreen'
import './auth.css'

/**
 * Resolves auth state on mount. When auth is enabled and the user is not
 * signed in, the login screen is shown; otherwise the app renders normally.
 * If the API is unreachable (static demo), auth resolves as disabled and the
 * app renders without a login gate.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const needsLogin = useAuthStore((s) => s.needsLogin)
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (status === 'loading') {
    return (
      <div className="auth-splash" data-testid="auth-splash">
        Loading workspace…
      </div>
    )
  }

  if (needsLogin) {
    return <LoginScreen />
  }

  return <>{children}</>
}
