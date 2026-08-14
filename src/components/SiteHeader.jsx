import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/images/power-within-collective-logo.png'
import { preloadPrimaryPublicRoutes, preloadPublicRoute } from '../lib/publicRoutePreloaders.js'
import './SiteHeader.css'

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Experiences', to: '/experiences', relatedPaths: ['/color-analysis', '/style-analysis', '/blend-cosmetics', '/radiance-reclaimed'] },
  { label: 'Resources', to: '/resources' },
  { label: 'Professionals', to: '/professionals', relatedPaths: ['/power-within-professional'] },
  { label: 'Teen Programs', to: '/teen-programs', relatedPaths: ['/teens'] },
  { label: 'Podcast', to: '/podcast' },
  { label: 'About', to: '/about' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' },
]

function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    const preload = () => preloadPrimaryPublicRoutes()
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(preload, { timeout: 2500 })
      : window.setTimeout(preload, 1800)

    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      } else {
        window.clearTimeout(idleId)
      }
    }
  }, [])

  const closeMenu = () => setIsOpen(false)

  return (
    <header className="site-header">
      <nav className="site-navigation" aria-label="Primary navigation">
        <NavLink
          className="site-brand"
          to="/"
          onClick={closeMenu}
          aria-label="Power Within Collective home"
        >
          <img src={logo} alt="" />
        </NavLink>

        <ul id="primary-navigation" className={`site-nav-links${isOpen ? ' is-open' : ''}`}>
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={closeMenu}
                onMouseEnter={() => preloadPublicRoute(item.to)}
                onFocus={() => preloadPublicRoute(item.to)}
                onTouchStart={() => preloadPublicRoute(item.to)}
                className={({ isActive }) => (isActive || item.relatedPaths?.includes(pathname) ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="site-header-actions">
          <button
            className="menu-button"
            type="button"
            aria-expanded={isOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </nav>
    </header>
  )
}

export default SiteHeader
