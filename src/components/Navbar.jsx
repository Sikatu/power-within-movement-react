import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import headerLogo from '../assets/images/logo.webp'

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 820
  })

  useEffect(() => {
    const syncMobileState = () => {
      const mobile = window.innerWidth <= 820
      setIsMobile(mobile)
      if (!mobile) setIsOpen(false)
    }

    syncMobileState()
    window.addEventListener('resize', syncMobileState)

    return () => window.removeEventListener('resize', syncMobileState)
  }, [])

  const closeMenu = () => setIsOpen(false)
  const shouldShowLinks = !isMobile || isOpen

  return (
    <header className="site-header">
      <nav className="navbar navbar-premium">
        <NavLink to="/" className="premium-logo-image" onClick={closeMenu}>
          <img src={headerLogo} alt="Power Within Collective" />
        </NavLink>

        {shouldShowLinks && (
          <ul className={isOpen ? 'nav-links open' : 'nav-links'}>
            <li><NavLink to="/" onClick={closeMenu}>Home</NavLink></li>
            <li><NavLink to="/experiences" onClick={closeMenu}>Experiences</NavLink></li>
            <li><NavLink to="/resources" onClick={closeMenu}>The Vault</NavLink></li>
            <li><NavLink to="/professionals" onClick={closeMenu}>Professionals</NavLink></li>
            <li><NavLink to="/podcast" onClick={closeMenu}>Podcast</NavLink></li>
            <li><NavLink to="/teens" onClick={closeMenu}>Teen Programs</NavLink></li>
            <li><NavLink to="/about" onClick={closeMenu}>About</NavLink></li>
            <li><NavLink to="/contact" onClick={closeMenu}>Contact</NavLink></li>
          </ul>
        )}

        {!isMobile && (
          <NavLink
            to="/client-portal/login"
            className="nav-account-link"
            onClick={closeMenu}
            aria-label="Client portal login"
            title="Client portal login"
          >
            <svg className="nav-account-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 12.25c2.35 0 4.25-1.9 4.25-4.25S14.35 3.75 12 3.75 7.75 5.65 7.75 8 9.65 12.25 12 12.25Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.75 20.25c.7-3.35 3.6-5.55 7.25-5.55s6.55 2.2 7.25 5.55" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only">Client portal login</span>
          </NavLink>
        )}

        {isMobile && (
          <button
            className="menu-button"
            type="button"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
        )}
      </nav>
    </header>
  )
}

export default Navbar
