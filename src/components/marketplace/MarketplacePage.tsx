import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { MarketplacePortal } from './MarketplacePortal'
import './marketplace.css'

/**
 * Standalone marketplace site (marketplace.langstitch.com). Unlike the in-IDE
 * portal it never blocks anonymous browsing behind a login gate — visitors can
 * browse the catalog and sign in from the header to acquire or publish plugins.
 */
export function MarketplacePage() {
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return <MarketplacePortal open standalone onClose={() => {}} />
}
