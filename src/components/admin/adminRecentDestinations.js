const RECENT_STORAGE_KEY = 'pwc_admin_recent_destinations'
const MAX_RECENT_DESTINATIONS = 5

export function readRecentDestinations() {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((path) => typeof path === 'string') : []
  } catch {
    return []
  }
}

export function rememberAdminDestination(pathname) {
  if (typeof window === 'undefined' || !pathname?.startsWith('/admin/')) return

  const ignoredRoutes = new Set(['/admin/login', '/admin/change-password'])
  if (ignoredRoutes.has(pathname)) return

  const next = [
    pathname,
    ...readRecentDestinations().filter((path) => path !== pathname),
  ].slice(0, MAX_RECENT_DESTINATIONS)

  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quick Find still works when browser storage is unavailable.
  }
}
