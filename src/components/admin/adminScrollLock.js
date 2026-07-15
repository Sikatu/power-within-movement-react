let activeLocks = 0

function scrollRoot() {
  return typeof document === 'undefined' ? null : document.documentElement
}

function scrollBody() {
  return typeof document === 'undefined' ? null : document.body
}

function syncScrollLock() {
  const root = scrollRoot()
  const body = scrollBody()
  const locked = activeLocks > 0

  root?.classList.toggle('admin-scroll-locked', locked)
  body?.classList.toggle('admin-scroll-locked', locked)
}

export function acquireAdminScrollLock() {
  if (typeof document === 'undefined') return () => {}

  activeLocks += 1
  syncScrollLock()
  let released = false

  return () => {
    if (released) return
    released = true
    activeLocks = Math.max(0, activeLocks - 1)
    syncScrollLock()
  }
}

export function resetAdminScrollLocks() {
  activeLocks = 0
  syncScrollLock()
}

export function mountAdminScrollRoot() {
  const root = scrollRoot()
  root?.classList.add('admin-app-root')
  root?.style.removeProperty('overflow')
  scrollBody()?.style.removeProperty('overflow')
  resetAdminScrollLocks()

  return () => {
    resetAdminScrollLocks()
    root?.classList.remove('admin-app-root')
  }
}
