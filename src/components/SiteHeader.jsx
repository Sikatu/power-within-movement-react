import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import './SiteHeader.css'

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Experiences', to: '/experiences', relatedPaths: ['/color-analysis', '/style-analysis', '/blend-cosmetics', '/radiance-reclaimed'] },
  { label: 'The Vault', to: '/resources' },
  { label: 'Professionals', to: '/professionals' },
  { label: 'Podcast', to: '/podcast' },
  { label: 'Teen Programs', to: '/teen-programs' },
  { label: 'About', to: '/about' },
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

  const closeMenu = () => setIsOpen(false)

  return (
    <header className="site-header">
      <nav className="site-navigation" aria-label="Primary navigation">
        <NavLink className="site-brand" to="/" onClick={closeMenu}>
          <img src={logo} alt="" />
          <span className="site-brand-full">Power Within Collective</span>
          <span className="site-brand-short">Power Within</span>
        </NavLink>

        <ul id="primary-navigation" className={`site-nav-links${isOpen ? ' is-open' : ''}`}>
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={closeMenu}
                className={({ isActive }) => (isActive || item.relatedPaths?.includes(pathname) ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          <li className="site-nav-mobile-portal">
            <NavLink to="/client-portal/login" onClick={closeMenu}>Client Portal</NavLink>
          </li>
        </ul>

        <div className="site-header-actions">
          <NavLink className="portal-link" to="/client-portal/login" aria-label="Client portal login">K</NavLink>
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
