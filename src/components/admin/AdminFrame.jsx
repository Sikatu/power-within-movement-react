import { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'

const studioNavItems = [
  {
    to: '/admin/dashboard',
    label: 'The Studio',
  },

  {
    to: '/admin/clients',
    label: 'Client Circle',
  },
  {
    to: '/admin/scheduler',
    label: 'Sessions & Calendar',
  },
  {
    to: '/admin/email-studio',
    label: 'Letters & Broadcasts',
  },
  {
    to: '/admin/courses',
    label: 'Learning Library',
  },
  {
    to: '/admin/memberships',
    label: 'Membership Circle',
  },
  {
    to: '/admin/encouragements',
    label: 'Daily Encouragements',
  },
  {
    to: '/admin/audit-log',
    label: 'Activity Journal',
  },
]

function AdminFrame({ children }) {
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

        <nav className="pwc-admin-nav pwc-studio-nav" aria-label="Studio navigation">
          {studioNavItems.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
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