import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/images/power-within-collective-logo.png'
import { preloadPublicRoute } from '../lib/publicRoutePreloaders.js'
import './SiteHeader.css'

const primaryNavigation = [
  {
    label: 'Radiance Reclaimed',
    to: '/radiance-reclaimed',
  },
  {
    label: 'Personal Presence',
    to: '/experiences',
    relatedPaths: [
      '/color-analysis',
      '/style-analysis',
      '/blend-cosmetics',
    ],
  },
  {
    label: 'About Kim',
    to: '/about',
  },
  {
    label: 'Resources',
    to: '/resources',
    matchPrefix: true,
  },
]

const secondaryNavigation = [
  {
    label: 'For Professionals',
    to: '/professionals',
    relatedPaths: ['/power-within-professional'],
  },
  {
    label: 'Podcast',
    to: '/podcast',
  },
  {
    label: 'Teen & Family',
    to: '/teen-programs',
    relatedPaths: ['/teens'],
  },
  {
    label: 'FAQ',
    to: '/faq',
  },
]

function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection

    if (
      connection?.saveData ||
      ['slow-2g', '2g'].includes(connection?.effectiveType)
    ) {
      return undefined
    }

    const priorityPaths = [
      '/radiance-reclaimed',
      '/experiences',
      '/resources',
      '/contact',
    ]

    const timerIds = []
    let idleId = null
    let scheduled = false

    const preloadInSequence = () => {
      priorityPaths.forEach((path, index) => {
        const timerId = window.setTimeout(() => {
          preloadPublicRoute(path)
        }, index * 300)

        timerIds.push(timerId)
      })
    }

    const schedulePreload = () => {
      if (scheduled) return
      scheduled = true

      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(
          preloadInSequence,
          { timeout: 3000 },
        )
      } else {
        idleId = window.setTimeout(
          preloadInSequence,
          1200,
        )
      }
    }

    if (document.readyState === 'complete') {
      schedulePreload()
    } else {
      window.addEventListener(
        'load',
        schedulePreload,
        { once: true },
      )
    }

    return () => {
      window.removeEventListener(
        'load',
        schedulePreload,
      )

      if (idleId !== null) {
        if (
          typeof window.cancelIdleCallback === 'function'
        ) {
          window.cancelIdleCallback(idleId)
        } else {
          window.clearTimeout(idleId)
        }
      }

      timerIds.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
    }
  }, [])

  const closeMenu = () => setIsOpen(false)

  const linkClass = (item, isActive) => {
    const relatedActive = item.relatedPaths?.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )

    const prefixActive =
      item.matchPrefix &&
      pathname !== '/' &&
      pathname.startsWith(`${item.to}/`)

    return isActive || relatedActive || prefixActive
      ? 'is-active'
      : undefined
  }

  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={closeMenu}
      onMouseEnter={() => preloadPublicRoute(item.to)}
      onFocus={() => preloadPublicRoute(item.to)}
      onTouchStart={() => preloadPublicRoute(item.to)}
      className={({ isActive }) => linkClass(item, isActive)}
    >
      {item.label}
    </NavLink>
  )

  return (
    <header className="site-header">
      <nav
        className="site-navigation"
        aria-label="Primary navigation"
      >
        <NavLink
          className="site-brand"
          to="/"
          onClick={closeMenu}
          aria-label="Power Within Collective home"
        >
          <img
            src={logo}
            alt=""
            width="398"
            height="198"
          />
        </NavLink>

        <div
          id="primary-navigation"
          className={`site-nav-panel${isOpen ? ' is-open' : ''}`}
        >
          <ul className="site-nav-links">
            {primaryNavigation.map((item) => (
              <li key={item.to}>
                {renderLink(item)}
              </li>
            ))}
          </ul>

          <div className="site-nav-secondary-wrap">
            <p>More from Power Within</p>

            <ul
              className="site-nav-secondary"
              aria-label="More from Power Within"
            >
              {secondaryNavigation.map((item) => (
                <li key={item.to}>
                  {renderLink(item)}
                </li>
              ))}
            </ul>
          </div>

          <NavLink
            className="site-nav-mobile-cta"
            to="/contact"
            onClick={closeMenu}
          >
            Start a Conversation
          </NavLink>
        </div>

        <div className="site-header-actions">
          <NavLink
            className="site-header-cta"
            to="/contact"
            onClick={closeMenu}
          >
            Start a Conversation
          </NavLink>

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
