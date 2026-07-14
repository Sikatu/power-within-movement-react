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
import {
  checkAdminAccess,
  getMyTeamAccess,
  logoutAdmin,
} from '../../lib/nativeApi'

import '../../pages/admin/AdminFreshUI.css'

const primaryItems = [
  {
    id: 'overview',
    to: '/admin/dashboard',
    label: 'Overview',
    module: 'dashboard',
    icon: 'overview',
  },
  {
    id: 'clients',
    to: '/admin/clients',
    label: 'Clients',
    module: 'clients',
    icon: 'clients',
    match: ['/admin/clients', '/admin/client-360'],
  },
  {
    id: 'sessions',
    to: '/admin/scheduler',
    label: 'Sessions',
    module: 'sessions',
    icon: 'sessions',
  },
  {
    id: 'inbox',
    to: '/admin/inbox',
    label: 'Inbox',
    module: 'inbox',
    icon: 'inbox',
  },
]

const groupedItems = [
  {
    id: 'growth',
    label: 'Growth',
    description: 'Leads, onboarding, and nurture',
    items: [
      {
        to: '/admin/leads',
        label: 'Leads & Intake',
        module: 'clients',
      },
      {
        to: '/admin/onboarding',
        label: 'Booking & Onboarding',
        module: 'clients',
      },
      {
        to: '/admin/automations',
        label: 'Automations',
        module: 'communications',
      },
    ],
  },
  {
    id: 'client-experience',
    label: 'Client Experience',
    description: 'Programs and community',
    items: [
      {
        to: '/admin/encouragements',
        label: 'Daily Encouragements',
        module: 'encouragements',
      },
      {
        to: '/admin/courses',
        label: 'Learning Library',
        module: 'learning',
      },
      {
        to: '/admin/memberships',
        label: 'Membership Circle',
        module: 'memberships',
      },
      {
        to: '/admin/circle',
        label: 'The Circle',
        module: 'circle',
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Letters and session updates',
    items: [
      {
        to: '/admin/email-studio',
        label: 'Letters & Broadcasts',
        module: 'communications',
      },
      {
        to: '/admin/session-changes',
        label: 'Session Changes',
        module: 'sessions',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'People and accountability',
    items: [
      {
        to: '/admin/audit-log',
        label: 'Activity Journal',
        module: 'audit',
      },
      {
        to: '/admin/team',
        label: 'Staff & Team Management',
        developerOnly: true,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Developer-only controls',
    developerOnly: true,
    items: [
      {
        to: '/admin/developer',
        label: 'Developer Control Center',
        developerOnly: true,
        exact: true,
      },
      {
        to: '/admin/developer/errors',
        label: 'Developer Error Center',
        developerOnly: true,
      },
    ],
  },
]

const workspaceDefinitions = [
  {
    id: 'studio',
    label: 'The Studio',
    description: 'Business operations',
    to: '/admin/dashboard',
    roles: ['developer', 'owner', 'admin', 'staff'],
  },
  {
    id: 'founder',
    label: 'Founder’s View',
    description: 'Owner clarity and approvals',
    to: '/admin/founders-view',
    roles: ['developer', 'owner'],
  },
  {
    id: 'developer',
    label: 'Developer Control Center',
    description: 'System health and governance',
    to: '/admin/developer',
    roles: ['developer'],
  },
]

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

function currentWorkspaceId(pathname) {
  if (pathname.startsWith('/admin/developer')) return 'developer'
  if (pathname.startsWith('/admin/founders')) return 'founder'
  return 'studio'
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
    </svg>
  )
}

function AdminFrame({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const workspaceRef = useRef(null)
  const mobileTriggerRef = useRef(null)
  const mainContentRef = useRef(null)
  const previousPathRef = useRef(location.pathname)
  const [adminUser, setAdminUser] = useState(readCachedUser)
  const [roleVerified, setRoleVerified] = useState(false)
  const [teamAccess, setTeamAccess] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openGroupOverride, setOpenGroupOverride] = useState(undefined)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const role = roleVerified ? adminUser?.role : null
  const isDeveloper = role === 'developer'
  const isStaff = role === 'staff'

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
      if (item.developerOnly) return isDeveloper
      if (!isStaff) return true
      if (!item.module) return false

      return (teamAccess?.permissions?.[item.module] || 'none') !== 'none'
    },
    [isDeveloper, isStaff, roleVerified, teamAccess],
  )

  const accessiblePrimaryItems = useMemo(
    () => primaryItems.filter(canAccessItem),
    [canAccessItem],
  )

  const accessibleGroups = useMemo(
    () => groupedItems
      .filter((group) => !group.developerOnly || isDeveloper)
      .map((group) => ({
        ...group,
        items: group.items.filter(canAccessItem),
      }))
      .filter((group) => group.items.length > 0),
    [canAccessItem, isDeveloper],
  )

  const accessibleWorkspaces = useMemo(
    () => workspaceDefinitions.filter(
      (workspace) => role && workspace.roles.includes(role),
    ),
    [role],
  )

  const activeWorkspace = useMemo(() => {
    const workspaceId = currentWorkspaceId(location.pathname)

    return accessibleWorkspaces.find((workspace) => workspace.id === workspaceId)
      || accessibleWorkspaces[0]
      || workspaceDefinitions[0]
  }, [accessibleWorkspaces, location.pathname])

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
    document.body.classList.add('admin-app-mode')

    return () => {
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMobileOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 0)
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
  }, [mobileOpen, workspaceOpen])

  useEffect(() => {
    if (!mobileOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  useEffect(() => {
    const previousPath = previousPathRef.current
    previousPathRef.current = location.pathname

    const frame = window.requestAnimationFrame(() => {
      setWorkspaceOpen(false)
      setMobileOpen(false)
      setSearchQuery('')
      setOpenGroupOverride(undefined)

      if (previousPath !== location.pathname) {
        mainContentRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  const searchableItems = useMemo(
    () => [
      ...accessiblePrimaryItems.map((item) => ({
        ...item,
        groupLabel: 'Primary',
      })),
      ...accessibleGroups.flatMap((group) => group.items.map((item) => ({
        ...item,
        groupLabel: group.label,
      }))),
    ],
    [accessibleGroups, accessiblePrimaryItems],
  )

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return []

    return searchableItems.filter((item) => (
      `${item.label} ${item.groupLabel}`.toLowerCase().includes(normalizedQuery)
    ))
  }, [searchQuery, searchableItems])

  const currentNavigationItem = useMemo(
    () => searchableItems.find((item) => routeMatches(location.pathname, item)),
    [location.pathname, searchableItems],
  )

  const currentTeamAccessLevel = isStaff && currentNavigationItem?.module
    ? teamAccess?.permissions?.[currentNavigationItem.module] || 'none'
    : null

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
    setSearchQuery('')
    setOpenGroupOverride(undefined)
  }

  function chooseWorkspace(workspace) {
    prepareForNavigation()
    navigate(workspace.to)
  }

  return (
    <div className="pwc-admin-shell pwc-studio-shell pwc-nav33-shell">
      <button
        ref={mobileTriggerRef}
        className="pwc-nav33-mobile-trigger"
        type="button"
        aria-label="Open Studio navigation"
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
        className={`pwc-admin-sidebar pwc-studio-sidebar pwc-nav33-sidebar${mobileOpen ? ' is-open' : ''}`}
        aria-label="Studio sidebar"
      >
        <div className="pwc-nav33-header" role="banner">
          <div className="pwc-nav33-brand-row">
            <Link
              className="pwc-nav33-brand-link"
              to="/admin/dashboard"
              aria-label="Power Within Collective — The Studio home"
              onClick={prepareForNavigation}
            >
              <span className="pwc-nav33-logo-mark" aria-hidden="true">
                <img src="/favicon.webp" alt="" />
              </span>
              <span className="pwc-nav33-brand-copy">
                <small>Power Within Collective</small>
                <strong>The Studio</strong>
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
            <span className="sr-only">Search Studio navigation</span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              placeholder="Jump to…"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </label>
        </div>

        <nav className="pwc-admin-nav pwc-studio-nav pwc-nav33-nav" aria-label="Studio navigation">
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
                  onClick={prepareForNavigation}
                >
                  <span>{item.label}</span>
                  <small>{item.groupLabel}</small>
                </Link>
              ))}
            </section>
          ) : (
            <>
              <section className="pwc-nav33-primary" aria-label="Primary Studio destinations">
                {accessiblePrimaryItems.map((item) => (
                  <NavLink
                    className={routeMatches(location.pathname, item) ? 'is-active' : undefined}
                    key={item.to}
                    to={item.to}
                    aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
                    onClick={prepareForNavigation}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </section>

              <div className="pwc-nav33-divider" />

              <section className="pwc-nav33-groups" aria-label="More Studio destinations">
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
                        {group.items.map((item) => (
                          <NavLink
                            className={routeMatches(location.pathname, item) ? 'is-active' : undefined}
                            key={item.to}
                            to={item.to}
                            aria-current={routeMatches(location.pathname, item) ? 'page' : undefined}
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
        </nav>

        <div className="pwc-nav33-footer" role="contentinfo">
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
    </div>
  )
}

export default AdminFrame
