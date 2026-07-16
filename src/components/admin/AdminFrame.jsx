import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import NotificationCenter from '../NotificationCenter'
import AdminCommandPalette from './AdminCommandPalette.jsx'
import { rememberAdminDestination } from './adminRecentDestinations.js'
import {
  PINNED_STORAGE_KEY,
  readPinnedDestinations,
  togglePinnedDestination,
} from './adminPinnedDestinations.js'
import {
  checkAdminAccess,
  getMyTeamAccess,
  logoutAdmin,
} from '../../lib/nativeApi'
import {
  preloadAdminRoute,
  preloadAdminRoutes,
} from './adminRoutePreloaders.js'
import {
  acquireAdminScrollLock,
  mountAdminScrollRoot,
} from './adminScrollLock.js'
import {
  studioGroups,
  workspaceDefinitions,
  workspaceForPath,
  workspacePrimaryItems,
} from './adminNavigation.js'

import '../../pages/admin/AdminFreshUI.css'

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function routeMatches(pathname, item) {
  const matches = item.match || [item.to]

  if (item.exact) return pathname === item.to

  return matches.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

function roleLabel(role) {
  const labels = {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }

  return labels[role] || 'Private account'
}

function NavIcon({ name }) {
  if (name === 'overview') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </svg>
    )
  }

  if (name === 'clients') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 11a3 3 0 1 0 0-6M21 20v-2a4 4 0 0 0-3-3.87" />
      </svg>
    )
  }

  if (name === 'sessions') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3v3M19 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 13h3M8 17h6" />
      </svg>
    )
  }

  if (name === 'inbox') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
      </svg>
    )
  }

  if (name === 'founder') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3ZM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16Z" />
      </svg>
    )
  }

  if (name === 'calendar' || name === 'availability') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3v3M19 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 13h3M8 17h7" />
      </svg>
    )
  }

  if (['developer', 'errors', 'security', 'release', 'team'].includes(name)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l8 3v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3ZM9 12l2 2 4-5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  )
}

function AdminFrame({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const workspaceRef = useRef(null)
  const sidebarRef = useRef(null)
  const mobileTriggerRef = useRef(null)
  const mainContentRef = useRef(null)
  const previousPathRef = useRef(location.pathname)
  const [adminUser, setAdminUser] = useState(readCachedUser)
  const [roleVerified, setRoleVerified] = useState(false)
  const [teamAccess, setTeamAccess] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openGroupOverride, setOpenGroupOverride] = useState(undefined)
  const [allToolsOpen, setAllToolsOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pinnedPaths, setPinnedPaths] = useState(readPinnedDestinations)
  const [signingOut, setSigningOut] = useState(false)
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ))

  const role = roleVerified ? adminUser?.role : null
  const isDeveloper = role === 'developer'
  const isStaff = role === 'staff'

  const warmRoute = useCallback((to) => {
    preloadAdminRoute(to)?.catch(() => {
      // A failed prefetch is retried by React.lazy during navigation.
    })
  }, [])

  const openCommandPalette = useCallback(() => {
    const restoreToMobileTrigger = mobileOpen

    setWorkspaceOpen(false)
    setMobileOpen(false)
    setSearchQuery('')

    window.requestAnimationFrame(() => {
      if (restoreToMobileTrigger) {
        mobileTriggerRef.current?.focus({ preventScroll: true })
      }
      setCommandOpen(true)
    })
  }, [mobileOpen])

  useEffect(() => {
    let active = true

    checkAdminAccess()
      .then((result) => {
        if (!active) return

        const verifiedUser = result?.user || null
        setAdminUser(verifiedUser)
        setRoleVerified(true)

        if (verifiedUser) {
          window.sessionStorage.setItem(
            'pwc_admin_user',
            JSON.stringify(verifiedUser),
          )
        }
      })
      .catch(() => {
        if (!active) return
        window.sessionStorage.removeItem('pwc_admin_user')
        navigate('/admin/login', {
          replace: true,
          state: { from: location.pathname },
        })
      })

    return () => {
      active = false
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    let active = true

    if (!roleVerified || !isStaff) return undefined

    getMyTeamAccess()
      .then((result) => {
        if (active) setTeamAccess(result.access || { permissions: {} })
      })
      .catch(() => {
        if (active) setTeamAccess({ permissions: {} })
      })

    return () => {
      active = false
    }
  }, [isStaff, roleVerified])

  const canAccessItem = useCallback(
    (item) => {
      if (!roleVerified) return false
      if (item.roles && !item.roles.includes(role)) return false
      if (item.developerOnly) return isDeveloper
      if (!isStaff) return true
      if (!item.module) return false

      return (teamAccess?.permissions?.[item.module] || 'none') !== 'none'
    },
    [isDeveloper, isStaff, role, roleVerified, teamAccess],
  )

  const accessibleWorkspaces = useMemo(
    () => workspaceDefinitions.filter(
      (workspace) => role && workspace.roles.includes(role),
    ),
    [role],
  )

  const activeWorkspace = useMemo(() => {
    const workspaceId = workspaceForPath(location.pathname)

    return accessibleWorkspaces.find((workspace) => workspace.id === workspaceId)
      || accessibleWorkspaces[0]
      || workspaceDefinitions[0]
  }, [accessibleWorkspaces, location.pathname])

  const allAccessiblePrimaryItems = useMemo(
    () => Object.entries(workspacePrimaryItems).flatMap(([workspaceId, items]) => (
      items.filter(canAccessItem).map((item) => ({
        ...item,
        workspaceId,
        workspaceLabel: workspaceDefinitions.find((workspace) => workspace.id === workspaceId)?.label,
      }))
    )),
    [canAccessItem],
  )

  const accessiblePrimaryItems = useMemo(
    () => allAccessiblePrimaryItems.filter(
      (item) => item.workspaceId === activeWorkspace.id,
    ),
    [activeWorkspace.id, allAccessiblePrimaryItems],
  )

  useEffect(() => {
    if (!roleVerified || !accessiblePrimaryItems.length) return undefined

    const paths = accessiblePrimaryItems.map((item) => item.to)
    const preload = () => {
      preloadAdminRoutes(paths)
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 1800 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(preload, 700)
    return () => window.clearTimeout(timeoutId)
  }, [accessiblePrimaryItems, roleVerified])

  const accessibleGroups = useMemo(
    () => studioGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(canAccessItem),
      }))
      .filter((group) => group.items.length > 0),
    [canAccessItem],
  )

  const activeGroupId = useMemo(
    () => accessibleGroups.find((group) => (
      group.items.some((item) => routeMatches(location.pathname, item))
    ))?.id || null,
    [accessibleGroups, location.pathname],
  )

  const openGroup = openGroupOverride === undefined
    ? activeGroupId
    : openGroupOverride

  useEffect(() => {
    function syncPinnedDestinations(event) {
      if (!event.key || event.key === PINNED_STORAGE_KEY) {
        setPinnedPaths(readPinnedDestinations())
      }
    }

    window.addEventListener('storage', syncPinnedDestinations)
    return () => window.removeEventListener('storage', syncPinnedDestinations)
  }, [])

  useEffect(() => {
    document.body.classList.add('admin-app-mode')
    const unmountScrollRoot = mountAdminScrollRoot()

    return () => {
      unmountScrollRoot()
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (mobileOpen && event.key === 'Tab' && sidebarRef.current) {
        const focusable = Array.from(sidebarRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => !element.closest('[hidden]') && element.getClientRects().length > 0)

        if (focusable.length) {
          const first = focusable[0]
          const last = focusable.at(-1)

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openCommandPalette()
        return
      }

      if (event.key === 'Escape' && commandOpen) {
        event.preventDefault()
        setCommandOpen(false)
        return
      }

      if (event.key === 'Escape') {
        const shouldReturnFocus = mobileOpen
        setWorkspaceOpen(false)
        setMobileOpen(false)
        setSearchQuery('')

        if (shouldReturnFocus) {
          window.setTimeout(() => mobileTriggerRef.current?.focus(), 0)
        }
      }
    }

    function handlePointerDown(event) {
      if (
        workspaceOpen
        && workspaceRef.current
        && !workspaceRef.current.contains(event.target)
      ) {
        setWorkspaceOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [commandOpen, mobileOpen, openCommandPalette, workspaceOpen])

  useEffect(() => {
    function updateConnectionStatus() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateConnectionStatus)
    window.addEventListener('offline', updateConnectionStatus)

    return () => {
      window.removeEventListener('online', updateConnectionStatus)
      window.removeEventListener('offline', updateConnectionStatus)
    }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return undefined
    return acquireAdminScrollLock()
  }, [mobileOpen])

  useEffect(() => {
    const previousPath = previousPathRef.current
    previousPathRef.current = location.pathname
    rememberAdminDestination(location.pathname)

    const frame = window.requestAnimationFrame(() => {
      setWorkspaceOpen(false)
      setMobileOpen(false)
      setCommandOpen(false)
      setSearchQuery('')
      setOpenGroupOverride(undefined)
      setAllToolsOpen(false)

      if (previousPath !== location.pathname) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        mainContentRef.current?.focus({ preventScroll: true })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  const searchableItems = useMemo(
    () => [
      ...allAccessiblePrimaryItems.map((item) => ({
        ...item,
        groupLabel: item.workspaceLabel || 'Workspace',
      })),
      ...accessibleGroups.flatMap((group) => group.items.map((item) => ({
        ...item,
        groupLabel: group.label,
      }))),
    ],
    [accessibleGroups, allAccessiblePrimaryItems],
  )

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return []

    return searchableItems.filter((item) => (
      `${item.label} ${item.groupLabel}`.toLowerCase().includes(normalizedQuery)
    ))
  }, [searchQuery, searchableItems])

  const commandItems = useMemo(() => [
    ...accessibleWorkspaces.map((workspace) => ({
      ...workspace,
      groupLabel: 'Workspaces',
      icon: 'workspace',
      keywords: ['workspace', workspace.id],
    })),
    ...allAccessiblePrimaryItems.map((item) => ({
      ...item,
      groupLabel: item.workspaceLabel || 'Workspace',
      description: item.description || `Open the ${item.label} workspace.`,
      keywords: ['primary', item.workspaceId, item.workspaceLabel],
    })),
    ...accessibleGroups.flatMap((group) => group.items.map((item) => ({
      ...item,
      groupLabel: group.label,
      description: group.description,
      icon: item.icon || 'overview',
      keywords: [group.id, group.label],
    }))),
  ], [accessibleGroups, allAccessiblePrimaryItems, accessibleWorkspaces])

  const pinnedItems = useMemo(() => {
    const uniqueItems = new Map(commandItems.map((item) => [item.to, item]))

    return pinnedPaths
      .map((path) => uniqueItems.get(path))
      .filter(Boolean)
  }, [commandItems, pinnedPaths])

  const currentNavigationItem = useMemo(
    () => searchableItems.find((item) => routeMatches(location.pathname, item)),
    [location.pathname, searchableItems],
  )

  const currentStudioTool = useMemo(() => {
    if (activeWorkspace.id !== 'studio') return null
    if (accessiblePrimaryItems.some((item) => routeMatches(location.pathname, item))) {
      return null
    }

    return accessibleGroups
      .flatMap((group) => group.items.map((item) => ({
        ...item,
        groupLabel: group.label,
      })))
      .find((item) => routeMatches(location.pathname, item)) || null
  }, [accessibleGroups, accessiblePrimaryItems, activeWorkspace.id, location.pathname])

  const currentTeamAccessLevel = isStaff && currentNavigationItem?.module
    ? teamAccess?.permissions?.[currentNavigationItem.module] || 'none'
    : null

  function handleTogglePinned(pathname) {
    setPinnedPaths(togglePinnedDestination(pathname))
  }

  function closeMobileNavigation({ returnFocus = true } = {}) {
    setMobileOpen(false)

    if (returnFocus) {
      window.setTimeout(() => mobileTriggerRef.current?.focus(), 0)
    }
  }

  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)

    try {
      await logoutAdmin()
    } catch {
      // Clear local state even when the server session has already expired.
    } finally {
      window.sessionStorage.removeItem('pwc_admin_user')
      window.sessionStorage.removeItem('pwc_founder_workspace_owner')
      navigate('/admin/login', { replace: true })
    }
  }

  function prepareForNavigation() {
    setMobileOpen(false)
    setWorkspaceOpen(false)
    setCommandOpen(false)
    setSearchQuery('')
    setOpenGroupOverride(undefined)
    setAllToolsOpen(false)
  }

  function chooseWorkspace(workspace) {
    prepareForNavigation()
    navigate(workspace.to)
  }

  function preloadInteractionProps(to) {
    return {
      onFocus: () => warmRoute(to),
      onMouseEnter: () => warmRoute(to),
      onPointerDown: () => warmRoute(to),
    }
  }

  return (
    <div className="pwc-admin-shell pwc-studio-shell pwc-nav33-shell">
      <button
        ref={mobileTriggerRef}
        className="pwc-nav33-mobile-trigger"
        type="button"
        aria-label={`Open ${activeWorkspace.label} navigation`}
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen(true)
          window.setTimeout(() => searchInputRef.current?.focus(), 0)
        }}
      >
        <span aria-hidden="true">☰</span>
        <strong>{currentNavigationItem?.label || activeWorkspace.label}</strong>
      </button>

      {mobileOpen && (
        <button
          className="pwc-nav33-mobile-backdrop"
          type="button"
          aria-label="Close Studio navigation"
          onClick={() => closeMobileNavigation()}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`pwc-admin-sidebar pwc-studio-sidebar pwc-nav33-sidebar${mobileOpen ? ' is-open' : ''}`}
        aria-label={`${activeWorkspace.label} sidebar`}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
      >
        <div className="pwc-nav33-header" role="banner">
          <div className="pwc-nav33-brand-row">
            <Link
              className="pwc-nav33-brand-link"
              to={activeWorkspace.to}
              aria-label={`Power Within Collective — ${activeWorkspace.label} home`}
              {...preloadInteractionProps(activeWorkspace.to)}
              onClick={prepareForNavigation}
            >
              <span className="pwc-nav33-logo-mark" aria-hidden="true">
                <img src="/favicon.webp" alt="" />
              </span>
              <span className="pwc-nav33-brand-copy">
                <small>Power Within Collective</small>
                <strong>{activeWorkspace.label}</strong>
              </span>
            </Link>

            <button
              className="pwc-nav33-mobile-close"
              type="button"
              aria-label="Close Studio navigation"
              onClick={() => closeMobileNavigation()}
            >
              ×
            </button>
          </div>

          <div className="pwc-nav33-workspace" ref={workspaceRef}>
            <button
              className="pwc-nav33-workspace-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={workspaceOpen}
              disabled={!roleVerified || accessibleWorkspaces.length < 2}
              onClick={() => setWorkspaceOpen((current) => !current)}
            >
              <span>
                <small>Current workspace</small>
                <strong>{activeWorkspace.label}</strong>
              </span>
              {accessibleWorkspaces.length > 1 && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              )}
            </button>

            {workspaceOpen && accessibleWorkspaces.length > 1 && (
              <div className="pwc-nav33-workspace-menu" role="menu">
                {accessibleWorkspaces.map((workspace) => (
                  <button
                    className={workspace.id === activeWorkspace.id ? 'is-active' : ''}
                    key={workspace.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={workspace.id === activeWorkspace.id}
                    {...preloadInteractionProps(workspace.to)}
                    onClick={() => chooseWorkspace(workspace)}
                  >
                    <span>{workspace.label}</span>
                    <small>{workspace.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="pwc-nav33-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <span className="sr-only">Search accessible workspaces</span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              placeholder="Find any tool…"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </label>
        </div>

        <nav className="pwc-admin-nav pwc-studio-nav pwc-nav33-nav" aria-label={`${activeWorkspace.label} navigation`}>
          {!roleVerified || (isStaff && !teamAccess) ? (
            <div className="pwc-nav33-loading" aria-label="Loading navigation">
              <span />
              <span />
              <span />
            </div>
          ) : searchQuery.trim() ? (
            <section className="pwc-nav33-search-results" aria-label="Navigation search results" aria-live="polite">
              <p>{filteredItems.length ? 'Matching destinations' : 'No matching destinations'}</p>

              {filteredItems.map((item) => (
                <Link
                  className={routeMatches(location.pathname, item) ? 'is-active' : ''}
                  key={`${item.groupLabel}-${item.to}`}
                  to={item.to}
                  aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
                  {...preloadInteractionProps(item.to)}
                  onClick={prepareForNavigation}
                >
                  <span>{item.label}</span>
                  <small>{item.groupLabel}</small>
                </Link>
              ))}
            </section>
          ) : (
            <>
              <div className="pwc-stream31-nav-heading">
                {activeWorkspace.id === 'studio' ? 'Daily work' : 'Workspace tools'}
              </div>

              <section className="pwc-nav33-primary" aria-label={`${activeWorkspace.label} primary destinations`}>
                {accessiblePrimaryItems.map((item) => (
                  <NavLink
                    className={routeMatches(location.pathname, item) ? 'is-active' : undefined}
                    key={item.to}
                    to={item.to}
                    aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
                    {...preloadInteractionProps(item.to)}
                    onClick={prepareForNavigation}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </section>

              {pinnedItems.length > 0 && (
                <section className="pwc-nav33-pinned" aria-label="Pinned Studio destinations">
                  <div className="pwc-nav33-pinned-heading">
                    <span>✦</span>
                    <strong>Pinned</strong>
                    <small>{pinnedItems.length}</small>
                  </div>
                  <div className="pwc-nav33-pinned-links">
                    {pinnedItems.map((item) => (
                      <div className="pwc-nav33-pinned-row" key={`pinned-${item.to}`}>
                        <NavLink
                          className={routeMatches(location.pathname, item) ? 'is-active' : undefined}
                          to={item.to}
                          aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
                          {...preloadInteractionProps(item.to)}
                          onClick={prepareForNavigation}
                        >
                          <span>{item.label}</span>
                        </NavLink>
                        <button
                          type="button"
                          aria-label={`Unpin ${item.label}`}
                          title={`Unpin ${item.label}`}
                          onClick={() => handleTogglePinned(item.to)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeWorkspace.id === 'studio' && (
                <>
                  {currentStudioTool && !allToolsOpen && (
                    <section className="pwc-stream31-current" aria-label="Current Studio tool">
                      <span>Current tool</span>
                      <NavLink
                        className="is-active"
                        to={currentStudioTool.to}
                        aria-current="page"
                        {...preloadInteractionProps(currentStudioTool.to)}
                        onClick={prepareForNavigation}
                      >
                        <strong>{currentStudioTool.label}</strong>
                        <small>{currentStudioTool.groupLabel}</small>
                      </NavLink>
                    </section>
                  )}

                  <div className="pwc-nav33-divider" />

                  <button
                    className={`pwc-stream31-tools-toggle${allToolsOpen ? ' is-open' : ''}`}
                    type="button"
                    aria-expanded={allToolsOpen}
                    aria-controls="pwc-stream31-all-tools"
                    onClick={() => setAllToolsOpen((current) => !current)}
                  >
                    <span>
                      <strong>{allToolsOpen ? 'Hide all tools' : 'Browse all tools'}</strong>
                      <small>{accessibleGroups.reduce((total, group) => total + group.items.length, 0)} focused workspaces</small>
                    </span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>

                  <section
                    className="pwc-nav33-groups pwc-stream31-all-tools"
                    id="pwc-stream31-all-tools"
                    aria-label="All Studio tools"
                    hidden={!allToolsOpen}
                  >
                    {accessibleGroups.map((group) => {
                      const isOpen = openGroup === group.id
                      const isActive = group.id === activeGroupId

                      return (
                        <div
                          className={`pwc-nav33-group${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}`}
                          key={group.id}
                        >
                          <button
                            className="pwc-nav33-group-trigger"
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`pwc-nav33-group-${group.id}`}
                            onClick={() => setOpenGroupOverride((current) => {
                              const resolvedCurrent = current === undefined ? activeGroupId : current
                              return resolvedCurrent === group.id ? null : group.id
                            })}
                          >
                            <span>
                              <strong>{group.label}</strong>
                              <small>{group.description}</small>
                            </span>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </button>

                          <div
                            className="pwc-nav33-group-links"
                            id={`pwc-nav33-group-${group.id}`}
                            hidden={!isOpen}
                          >
                            {group.items.filter((item) => !item.hiddenInSidebar).map((item) => (
                              <NavLink
                                className={routeMatches(location.pathname, item) ? 'is-active' : undefined}
                                key={item.to}
                                to={item.to}
                                aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
                                {...preloadInteractionProps(item.to)}
                                onClick={prepareForNavigation}
                              >
                                {item.label}
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </section>
                </>
              )}
            </>
          )}
        </nav>

        <div className="pwc-nav33-footer" role="contentinfo">
          <div
            className={`pwc-nav33-connection${isOnline ? ' is-online' : ' is-offline'}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" />
            <strong>{isOnline ? 'Studio connected' : 'Connection interrupted'}</strong>
            <small>{isOnline ? 'Changes can be saved securely.' : 'Reconnect before saving new changes.'}</small>
          </div>

          <NotificationCenter mode="admin" />

          <div className="pwc-nav33-account">
            <span className="pwc-nav33-avatar" aria-hidden="true">
              {roleLabel(role).charAt(0)}
            </span>
            <span>
              <small>Signed in as</small>
              <strong>{roleLabel(role)}</strong>
              <em title={adminUser?.email || ''}>{adminUser?.email || 'Private account'}</em>
            </span>
          </div>

          <div className="pwc-nav33-utilities">
            <button
              className="pwc-nav33-quick-find"
              type="button"
              onClick={openCommandPalette}
            >
              <span>Quick Find</span>
              <kbd>Ctrl K</kbd>
            </button>
            <Link to="/" onClick={prepareForNavigation}>View public site</Link>
            <button type="button" disabled={signingOut} onClick={handleSignOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      <main
        ref={mainContentRef}
        id="main-content"
        className="pwc-admin-main pwc-studio-main pwc-nav33-main"
        tabIndex={-1}
      >
        {currentTeamAccessLevel === 'view' && (
          <div className="pwc-studio-view-only-banner" role="status">
            <strong>View-only team access</strong>
            <span>Your role can review this area, but backend changes are blocked.</span>
          </div>
        )}
        {children}
      </main>

      {commandOpen && (
        <AdminCommandPalette
          currentPath={location.pathname}
          items={commandItems}
          onClose={() => setCommandOpen(false)}
          onNavigate={(to) => {
            prepareForNavigation()
            navigate(to)
          }}
          onWarmRoute={warmRoute}
          pinnedPaths={pinnedPaths}
          onTogglePinned={handleTogglePinned}
        />
      )}
    </div>
  )
}

export default AdminFrame
