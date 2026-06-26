export type AppMode = 'ide' | 'marketplace'

/**
 * Resolve which experience to boot. The same build serves both the IDE
 * (langstitch.com) and the standalone marketplace (marketplace.langstitch.com);
 * the host (or a build-time `VITE_APP_MODE` override) decides which one renders.
 */
export function resolveAppMode(): AppMode {
  const envMode = (import.meta.env.VITE_APP_MODE as string | undefined)?.toLowerCase()
  if (envMode === 'marketplace' || envMode === 'ide') {
    return envMode
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host === 'marketplace.langstitch.com' || host.startsWith('marketplace.')) {
      return 'marketplace'
    }
  }
  return 'ide'
}
