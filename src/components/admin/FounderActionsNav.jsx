import { Link } from 'react-router-dom'

export default function FounderActionsNav({
  currentTime,
  isSigningOut,
  onOpenMessageView,
  onLogout,
  className = '',
}) {
  return (
    <nav className={className} aria-label="Founder controls">
      {currentTime && (
        <div className="founder-home__clock">
          {currentTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </div>
      )}

      <Link to="/admin/dashboard" className="founder-home__studio-link">
        Open The Studio
      </Link>
      <button
        type="button"
        className="founder-home__calendar-link"
        onClick={onOpenMessageView}
      >
        Share a message
      </button>
      <button
        type="button"
        className="founder-home__signout"
        onClick={onLogout}
        disabled={isSigningOut}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  )
}
