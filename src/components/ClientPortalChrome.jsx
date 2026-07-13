import { Link, NavLink } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import './ClientPortalChrome.css'

const portalLinks = [
  ['/client-portal/home', 'Home'],
  ['/client-portal/circle', 'The Circle'],
  ['/client-portal/sessions', 'Sessions'],
  ['/client-portal/messages', 'Messages'],
]

function ClientPortalChrome({ client, loggingOut, messageCount = 0, onLogout }) {
  return (
    <>
      <header className="portal-chrome-header">
        <Link className="portal-chrome-brand" to="/client-portal/home" aria-label="Power Within client portal home">
          <img src={logo} alt="" />
          <span><strong>Power Within</strong>Client Portal</span>
        </Link>

        <div className="portal-chrome-account">
          <span className="portal-chrome-signed-in">
            <small>Signed in as</small>
            <strong>{client?.name || client?.email || 'Client'}</strong>
          </span>
          <Link to="/">Website</Link>
          <button type="button" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      <nav className="portal-chrome-nav" aria-label="Client portal">
        {portalLinks.map(([path, label]) => (
          <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'is-active' : '')}>
            {label}
            {label === 'Messages' && messageCount > 0 && <span>{messageCount}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export default ClientPortalChrome
