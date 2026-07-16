import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import { acceptPublicClientPortalInvite, getPublicClientPortalInvite } from '../lib/nativeApi.js'
import './PortalEntry.css'

function formatDateTime(value) {
  if (!value) return 'Not available'

  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return 'Not available'
  }
}

function getStatusCopy(status) {
  const current = String(status || '').toLowerCase()

  if (current === 'pending') {
    return {
      eyebrow: 'Private Setup',
      title: 'Set up your client portal access.',
      body: 'Create your private password once. After this, you will return through the Client Portal Login page.',
      canAccept: true,
      canLogin: false,
      canContact: false,
    }
  }

  if (current === 'accepted') {
    return {
      eyebrow: 'Portal Active',
      title: 'Your portal is already active.',
      body: 'This invitation has already been accepted. Please sign in with the email and password you created.',
      canAccept: false,
      canLogin: true,
      canContact: false,
    }
  }

  if (current === 'expired') {
    return {
      eyebrow: 'Expired Invite',
      title: 'This invitation has expired.',
      body: 'For your privacy, setup links expire. You can try logging in if your portal is already active, or contact Power Within for a fresh access link.',
      canAccept: false,
      canLogin: true,
      canContact: true,
    }
  }

  if (current === 'revoked') {
    return {
      eyebrow: 'Inactive Invite',
      title: 'This invitation is no longer active.',
      body: 'This setup link has been replaced or revoked. You can try logging in if your portal is already active, or contact Power Within for help.',
      canAccept: false,
      canLogin: true,
      canContact: true,
    }
  }

  return {
    eyebrow: 'Invite Unavailable',
    title: 'This invitation is not available.',
    body: 'Please contact Power Within if you need help with your private client portal access.',
    canAccept: false,
    canLogin: true,
    canContact: true,
  }
}

function getFriendlyInviteError(message) {
  const normalized = String(message || '').toLowerCase()

  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('load failed')) {
    return 'We could not open this invitation for a moment. Please refresh the page or try again shortly.'
  }

  if (normalized.includes('expired') || normalized.includes('inactive') || normalized.includes('revoked')) {
    return 'This invitation link is no longer active. Please contact Power Within for a fresh private portal invitation.'
  }

  return message || 'We could not open this invitation yet. Please try again shortly.'
}

function ClientPortalInvite() {
  const { token } = useParams()
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState({ state: 'loading', message: '' })

  useEffect(() => {
    document.body.classList.add('portal-entry-mode')
    return () => document.body.classList.remove('portal-entry-mode')
  }, [])

  useEffect(() => {
    let active = true

    getPublicClientPortalInvite(token)
      .then((response) => {
        if (!active) return
        setInvite(response.invite)
        setStatus({ state: 'idle', message: '' })
      })
      .catch((error) => {
        if (!active) return
        setInvite({ status: 'unavailable', client: { name: 'there' } })
        setStatus({ state: 'error', message: getFriendlyInviteError(error.message) })
      })

    return () => {
      active = false
    }
  }, [token])

  const statusCopy = useMemo(() => getStatusCopy(invite?.status), [invite?.status])
  const clientName = invite?.client?.name || 'there'
  const heroTitle = invite?.status === 'pending' ? `Welcome, ${clientName}.` : statusCopy.title

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setStatus({ state: 'error', message: 'Your passwords do not match yet.' })
      return
    }

    setStatus({ state: 'saving', message: '' })

    try {
      const response = await acceptPublicClientPortalInvite(token, { password, confirmPassword })
      setInvite(response.invite)
      setPassword('')
      setConfirmPassword('')
      setStatus({ state: 'success', message: response.message || 'Your client portal access has been created successfully.' })
    } catch (error) {
      setStatus({ state: 'error', message: getFriendlyInviteError(error.message) })
    }
  }

  return (
    <main id="main-content" className="portal-entry-page">
      <section className="portal-entry-shell">
        <div className="portal-entry-intro">
          <Link className="portal-entry-logo" to="/" aria-label="Return to Power Within Collective">
            <img src={logo} alt="" />
          </Link>
          <p className="eyebrow">Power Within Client Portal</p>
          <h1>{status.state === 'loading' ? 'Opening your private invitation.' : heroTitle}</h1>
          <p>{statusCopy.body}</p>
          <div className="portal-entry-trust" aria-label="Portal privacy features">
            <span>Secure invitation</span>
            <span>Private access</span>
            <span>Created once</span>
          </div>
        </div>

        <article className="portal-entry-card portal-invite-card">
          {status.state === 'loading' ? (
            <div className="portal-entry-loading" role="status">Opening your invitation…</div>
          ) : (
            <>
              <header>
                <p className="eyebrow">{statusCopy.eyebrow}</p>
                <h2>{statusCopy.title}</h2>
                {invite?.client?.email && <p>Invitation for <strong>{invite.client.email}</strong></p>}
                {statusCopy.canAccept && <p>Expires {formatDateTime(invite?.expiresAt)}</p>}
              </header>

              {status.message && (
                <div className={`portal-entry-alert ${status.state === 'error' ? 'is-error' : 'is-success'}`} role={status.state === 'error' ? 'alert' : 'status'}>
                  {status.message}
                </div>
              )}

              {statusCopy.canAccept ? (
                <form className="portal-entry-form" onSubmit={handleSubmit}>
                  <label>
                    <span>Create Password</span>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="12" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}" title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol." autoComplete="new-password" required />
                  </label>
                  <label>
                    <span>Confirm Password</span>
                    <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="12" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}" title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol." autoComplete="new-password" required />
                  </label>
                  <p className="portal-password-help">Use at least 12 characters with an uppercase letter, lowercase letter, number, and symbol.</p>
                  <button type="submit" disabled={status.state === 'saving'}>{status.state === 'saving' ? 'Creating Access…' : 'Create My Portal Access'}</button>
                </form>
              ) : (
                <div className="portal-invite-state">
                  <strong>{statusCopy.title}</strong>
                  <p>{statusCopy.body}</p>
                  <div>
                    {statusCopy.canLogin && <Link className="button button-primary" to="/client-portal/login">Go to Client Portal Login</Link>}
                    {statusCopy.canContact && <Link className="button button-secondary" to="/contact">Contact Power Within</Link>}
                  </div>
                </div>
              )}

              <Link className="portal-entry-return" to="/">← Return to Power Within</Link>
            </>
          )}
        </article>
      </section>
    </main>
  )
}

export default ClientPortalInvite
