export const ADMIN_COMFORT_STORAGE_KEY = 'pwc_admin_comfort_view'

export function readAdminComfortView() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(ADMIN_COMFORT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeAdminComfortView(enabled) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(ADMIN_COMFORT_STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // Private browsing or locked storage should not block the workspace.
  }
}
