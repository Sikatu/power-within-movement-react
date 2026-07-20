import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import { getClientPortalStudioIdentity } from '../lib/nativeApi.js'
import NotificationCenter from './NotificationCenter'
import './ClientPortalChrome.css'

const primaryPortalLinks = [
  ['/client-portal/home', 'Today'],
  ['/client-portal/journey', 'Journey'],
  ['/client-portal/resources', 'Library'],
  ['/client-portal/sessions', 'Sessions'],
  ['/client-portal/messages', 'Messages'],
]

const explorePortalLinks = [
  ['/client-portal/learning', 'Learning'],
  ['/client-portal/membership', 'Membership'],
  ['/client-portal/circle', 'The Circle'],
]

function ClientPortalChrome({ client, loggingOut, messageCount = 0, onLogout }) {
  const location = useLocation()
  const exploreRef = useRef(null)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [studioIdentity, setStudioIdentity] = useState(null)
  const [profileImageFailed, setProfileImageFailed] = useState(false)
  const exploreActive = explorePortalLinks.some(([path]) => location.pathname.startsWith(path))

  useEffect(() => {
    if (!exploreOpen) return undefined

    function closeExplore(event) {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !exploreRef.current?.contains(event.target))) {
        setExploreOpen(false)
      }
    }

    document.addEventListener('keydown', closeExplore)
    document.addEventListener('pointerdown', closeExplore)
    return () => {
      document.removeEventListener('keydown', closeExplore)
      document.removeEventListener('pointerdown', closeExplore)
    }
  }, [exploreOpen])

  useEffect(() => {
    let active = true
    getClientPortalStudioIdentity()
      .then((response) => {
        if (active) setStudioIdentity(response.identity || null)
      })
      .catch(() => {
        if (active) setStudioIdentity(null)
      })
    return () => { active = false }
  }, [])

  function portalLink([path, label]) {
    return (
      <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setExploreOpen(false)}>
        {label}
        {label === 'Messages' && messageCount > 0 && <span>{messageCount}</span>}
      </NavLink>
    )
  }

  return (
    <>
      <header className="portal-chrome-header">
        <Link className="portal-chrome-brand" to="/client-portal/home" aria-label="Power Within client portal home">
          <img
            className={studioIdentity?.profileImageUrl && !profileImageFailed ? 'is-profile' : ''}
            src={studioIdentity?.profileImageUrl && !profileImageFailed ? studioIdentity.profileImageUrl : logo}
            alt=""
            onError={() => setProfileImageFailed(true)}
          />
          <span><strong>{studioIdentity?.displayName || 'Power Within'}</strong>{studioIdentity ? 'Private Studio' : 'Client Portal'}</span>
        </Link>

        <div className="portal-chrome-account">
          <span className="portal-chrome-signed-in">
            <small>Signed in as</small>
            <strong>{client?.name || client?.email || 'Client'}</strong>
          </span>
          <NotificationCenter mode="client" />
          <NavLink to="/client-portal/account">Account</NavLink>
          <Link className="portal-chrome-website-link" to="/">Website</Link>
          <button type="button" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      <nav className="portal-chrome-nav" aria-label="Client portal">
        <div className="portal-chrome-primary-links">
          {primaryPortalLinks.map(portalLink)}
        </div>
        <div className="portal-chrome-explore" ref={exploreRef}>
          <button
            type="button"
            className={exploreActive ? 'is-active' : ''}
            aria-haspopup="menu"
            aria-expanded={exploreOpen}
            onClick={() => setExploreOpen((current) => !current)}
          >
            Explore
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
          {exploreOpen && (
            <div className="portal-chrome-explore-menu" role="menu">
              {explorePortalLinks.map(([path, label]) => (
                <NavLink key={path} to={path} role="menuitem" className={({ isActive }) => (isActive ? 'is-active' : '')} onClick={() => setExploreOpen(false)}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}

export default ClientPortalChrome
