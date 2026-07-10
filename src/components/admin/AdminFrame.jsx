import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const studioNavGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/admin/dashboard', label: 'Overview' },
      { to: '/admin/clients', label: 'Clients' },
      { to: '/admin/scheduler', label: 'Sessions' },
      { to: '/admin/email-studio', label: 'Communications' },
    ],
  },
  {
    label: 'Programs',
    items: [
      { to: '/admin/courses', label: 'Learning Library' },
      { to: '/admin/memberships', label: 'Memberships' },
      { to: '/admin/encouragements', label: 'Encouragements' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/admin/audit-log', label: 'Activity Journal' }],
  },
]


function AdminFrame({ children }) {
  const [adminUser] = useState(() => {
    if (typeof window === 'undefined') return null

    try {
      return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
    } catch {
      return null
    }
  })

  const isOwner = adminUser?.role === 'owner'
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
          {studioNavGroups.map((group) => (
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

        <div className="pwc-studio-profile-note">
          <span>Coming Later</span>
          <strong>Studio Profile</strong>
          <p>Photo, bio, signature, and brand details will live here soon.</p>
        </div>

        <Link className="pwc-admin-back-link pwc-studio-back-link" to="/">
          View Public Site
        </Link>
      </aside>

      <section className="pwc-admin-main pwc-studio-main">
        {children}
      </section>
    </main>
  )
}

export default AdminFrame