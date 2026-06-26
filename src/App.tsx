import { AppLayout } from './components/layout/AppLayout'
import { AuthGate } from './components/auth/AuthGate'
import { MarketplacePage } from './components/marketplace/MarketplacePage'
import { resolveAppMode } from './lib/appMode'

export default function App() {
  if (resolveAppMode() === 'marketplace') {
    return <MarketplacePage />
  }
  return (
    <AuthGate>
      <AppLayout />
    </AuthGate>
  )
}
