import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { logoutAdmin } from '../lib/nativeApi'
import StudioIcon from './StudioIcon.jsx'
import {
  studioNavigationForPath,
  studioPrimaryNavigation,
} from './studioNavigation.js'

function readCachedAdmin() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(
      window.sessionStorage.getItem('pwc_admin_user') || 'null',
    )
  } catch {
    return null
  }
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

export default function StudioShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedAdmin)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const activeItem = useMemo(
    () => studioNavigationForPath(location.pathname),
    [location.pathname],
  )

  const canOpenFounderView = ['developer', 'owner'].includes(
    adminUser?.role,
  )

  useEffect(() => {
    document.body.classList.add('studio-v2-mode')

    return () => {
      document.body.classList.remove('studio-v2-mode')
    }
  }, [])


  async function handleSignOut() {
    if (signingOut) return

    setSigningOut(true)

    try {
      await logoutAdmin()
    } finally {
      window.sessionStorage.removeItem('pwc_admin_user')
      navigate('/admin/login', { replace: true })
    }
  }

  return (
    <div className="studio-v2-app">
      <button
        aria-label="Close Studio navigation"
        className={`studio-v2-scrim${mobileOpen ? ' is-visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        type="button"
      />

      <aside
        aria-label="New Studio navigation"
        className={`studio-v2-sidebar${mobileOpen ? ' is-open' : ''}`}
        id="studio-v2-navigation"
      >
        <div className="studio-v2-brand">
          <span aria-hidden="true" className="studio-v2-brand-mark">
            <span />
            <span />
          </span>

          <span>
            <strong>Power Within Collective</strong>
            <small>The Studio</small>
          </span>
        </div>

        <nav className="studio-v2-nav">
          <p className="studio-v2-nav-label">Workspace</p>

          {studioPrimaryNavigation.map((item) => (
            <NavLink
              className={({ isActive }) => (
                `studio-v2-nav-item${isActive ? ' is-active' : ''}`
              )}
              key={item.id}
              onClick={() => setMobileOpen(false)}
              to={item.to}
            >
              <StudioIcon name={item.icon} />

              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="studio-v2-sidebar-footer">
          <div className="studio-v2-account">
            <span aria-hidden="true" className="studio-v2-avatar">
              {(adminUser?.displayName || adminUser?.email || 'S')
                .charAt(0)
                .toUpperCase()}
            </span>

            <span>
              <strong>
                {adminUser?.displayName
                  || adminUser?.name
                  || adminUser?.email
                  || 'Studio account'}
              </strong>
              <small>{roleLabel(adminUser?.role)}</small>
            </span>
          </div>

          <div className="studio-v2-utility-links">
            {canOpenFounderView && (
              <Link to="/admin/founders-view">Founder’s View</Link>
            )}

            <Link to="/admin/dashboard">Legacy Studio</Link>
          </div>

          <button
            className="studio-v2-signout"
            disabled={signingOut}
            onClick={handleSignOut}
            type="button"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <section className="studio-v2-content">
        <header className="studio-v2-mobile-header">
          <button
            aria-controls="studio-v2-navigation"
            aria-expanded={mobileOpen}
            aria-label="Open Studio navigation"
            className="studio-v2-menu-button"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>

          <div>
            <small>The Studio</small>
            <strong>{activeItem.label}</strong>
          </div>
        </header>

        <main className="studio-v2-main" id="main-content">
          {children}
        </main>
      </section>
    </div>
  )
}