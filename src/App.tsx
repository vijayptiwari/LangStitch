import { AppLayout } from './components/layout/AppLayout'
import { AuthGate } from './components/auth/AuthGate'

export default function App() {
  return (
    <AuthGate>
      <AppLayout />
    </AuthGate>
  )
}
