import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import NotificationCenter from '../NotificationCenter'
import { getMyTeamAccess } from '../../lib/nativeApi'

const studioNavGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin/dashboard', label: 'Overview', module: 'dashboard' },
      { to: '/admin/clients', label: 'Clients', module: 'clients' },
      { to: '/admin/leads', label: 'Leads & Intake', module: 'clients' },
      { to: '/admin/inbox', label: 'Secure Inbox', module: 'inbox' },
      { to: '/admin/scheduler', label: 'Sessions', module: 'sessions' },
      { to: '/admin/session-changes', label: 'Session Changes', module: 'sessions' },
      { to: '/admin/email-studio', label: 'Communications', module: 'communications' },
    ],
  },
  {
    label: 'Programs',
    items: [
      { to: '/admin/courses', label: 'Learning Library', module: 'learning' },
      { to: '/admin/memberships', label: 'Memberships', module: 'memberships' },
      { to: '/admin/circle', label: 'The Circle', module: 'circle' },
      { to: '/admin/encouragements', label: 'Encouragements', module: 'encouragements' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/admin/audit-log', label: 'Activity Journal', module: 'audit' }],
  },
]

function AdminFrame({ children }) {
  const location = useLocation()
  const [teamAccess, setTeamAccess] = useState(null)
  const [adminUser] = useState(() => {
    if (typeof window === 'undefined') return null

    try {
      return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
    } catch {
      return null
    }
  })

  const isOwner = adminUser?.role === 'owner'
  const isDeveloper = adminUser?.role === 'developer'
  const isStaff = adminUser?.role === 'staff'

  useEffect(() => {
    let active = true

    if (!isStaff) return undefined

    getMyTeamAccess()
      .then((result) => {
        if (active) setTeamAccess(result.access || null)
      })
      .catch(() => {
        if (active) setTeamAccess({ permissions: {} })
      })

    return () => {
      active = false
    }
  }, [isStaff])

  const navigationGroups = useMemo(() => {
    const groups = studioNavGroups.map((group) => {
      if (group.label !== 'System' || !isDeveloper) return group

      return {
        ...group,
        items: [
          { to: '/admin/developer', label: 'Developer Control Center' },
          { to: '/admin/team', label: 'Staff & Team Management' },
          ...group.items,
        ],
      }
    })

    if (!isStaff) return groups

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.module) return false
          return (teamAccess?.permissions?.[item.module] || 'none') !== 'none'
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [isDeveloper, isStaff, teamAccess])

  const currentNavigationItem = useMemo(
    () => navigationGroups
      .flatMap((group) => group.items)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)),
    [location.pathname, navigationGroups],
  )

  const currentTeamAccessLevel = isStaff && currentNavigationItem?.module
    ? teamAccess?.permissions?.[currentNavigationItem.module] || 'none'
    : null

  useEffect(() => {
    document.body.classList.add('admin-app-mode')

    return () => {
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  return (
    <main className="pwc-admin-shell pwc-studio-shell">
      <aside className="pwc-admin-sidebar pwc-studio-sidebar">
        <div className="pwc-admin-brand pwc-studio-brand">
          <p className="eyebrow">Power Within</p>
          <h2>The Studio</h2>
          <span>A private space for meaningful transformation.</span>
        </div>

        {isDeveloper && (
          <>
            <NavLink
              className={({ isActive }) =>
                `pwc-studio-founder-switch${isActive ? ' is-active' : ''}`
              }
              to="/admin/developer"
            >
              <span>Developer workspace</span>
              <strong>Control Center</strong>
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `pwc-studio-founder-switch${isActive ? ' is-active' : ''}`
              }
              to="/admin/founders-view"
            >
              <span>Live owner workspace</span>
              <strong>Founder’s View</strong>
            </NavLink>
          </>
        )}

        {isOwner && (
          <NavLink
            className={({ isActive }) =>
              `pwc-studio-founder-switch${isActive ? ' is-active' : ''}`
            }
            to="/admin/founders-view"
          >
            <span>Owner workspace</span>
            <strong>Founder’s View</strong>
          </NavLink>
        )}

        <nav className="pwc-admin-nav pwc-studio-nav" aria-label="Studio navigation">
          {navigationGroups.map((group) => (
            <section className="pwc-studio-nav-group" key={group.label}>
              <p>{group.label}</p>
              <div>
                {group.items.map((item) => (
                  <NavLink
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                    key={item.to}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <NotificationCenter mode="admin" />

        <div className="pwc-studio-profile-note">
          <span>Signed in as</span>
          <strong>{isDeveloper ? 'Developer' : isOwner ? 'Owner' : 'Studio Team'}</strong>
          <p>{adminUser?.email || 'Private account'}</p>
        </div>

        <Link className="pwc-admin-back-link pwc-studio-back-link" to="/">
          View Public Site
        </Link>
      </aside>

      <section className="pwc-admin-main pwc-studio-main">
        {currentTeamAccessLevel === 'view' && (
          <div className="pwc-studio-view-only-banner" role="status">
            <strong>View-only team access</strong>
            <span>Your role can review this area, but backend changes are blocked.</span>
          </div>
        )}
        {children}
      </section>
    </main>
  )
}

export default AdminFrame