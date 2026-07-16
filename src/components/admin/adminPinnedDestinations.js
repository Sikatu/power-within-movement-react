export const PINNED_STORAGE_KEY = 'pwc_admin_pinned_destinations'
const MAX_PINNED_DESTINATIONS = 6

function cleanPaths(value) {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value.filter((path) => (
      typeof path === 'string'
      && path.startsWith('/admin/')
      && !['/admin/login', '/admin/change-password'].includes(path)
    )),
  )).slice(0, MAX_PINNED_DESTINATIONS)
}

export function readPinnedDestinations() {
  if (typeof window === 'undefined') return []

  try {
    return cleanPaths(JSON.parse(
      window.localStorage.getItem(PINNED_STORAGE_KEY) || '[]',
    ))
  } catch {
    return []
  }
}

export function writePinnedDestinations(paths) {
  const next = cleanPaths(paths)
  if (typeof window === 'undefined') return next

  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Pinned navigation remains usable for this session when storage is unavailable.
  }

  return next
}

export function togglePinnedDestination(pathname) {
  if (!pathname?.startsWith('/admin/')) return readPinnedDestinations()

  const current = readPinnedDestinations()
  const next = current.includes(pathname)
    ? current.filter((path) => path !== pathname)
    : [pathname, ...current]

  return writePinnedDestinations(next)
}
