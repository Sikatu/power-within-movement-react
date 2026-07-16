import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import { getClientPortalMe, loginClientPortal } from '../lib/nativeApi.js'
import './PortalEntry.css'

function getFriendlyLoginError(message) {
  const normalized = String(message || '').toLowerCase()

  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('load failed')) {
    return 'We could not connect to the private portal for a moment. Please check your connection and try again.'
  }

  if (normalized.includes('invalid') || normalized.includes('incorrect') || normalized.includes('unauthorized') || normalized.includes('401')) {
    return 'The email or password did not match an active client portal account.'
  }

  return message || 'We could not sign you in yet. Please try again shortly.'
}

function ClientPortalLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ state: 'idle', message: '' })

  useEffect(() => {
    document.body.classList.add('portal-entry-mode')
    return () => document.body.classList.remove('portal-entry-mode')
  }, [])

  useEffect(() => {
    let active = true

    getClientPortalMe()
      .then(() => {
        if (active) navigate('/client-portal/home', { replace: true })
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ state: 'loading', message: '' })

    try {
      await loginClientPortal({ email: email.trim().toLowerCase(), password })
      navigate('/client-portal/home')
    } catch (error) {
      setStatus({ state: 'error', message: getFriendlyLoginError(error.message) })
    }
  }

  const handleForgotPassword = () => {
    setStatus({
      state: 'notice',
      message: 'Password recovery is handled personally for your privacy. Contact Power Within and the team will help restore your access safely.',
    })
  }

  return (
    <main id="main-content" className="portal-entry-page">
      <section className="portal-entry-shell">
        <div className="portal-entry-intro">
          <Link className="portal-entry-logo" to="/" aria-label="Return to Power Within Collective">
            <img src={logo} alt="" />
          </Link>
          <p className="eyebrow">Power Within Client Portal</p>
          <h1>Your private space for care.</h1>
          <p>Sign in to return to your private notes, resources, session history, reminders, and client care prepared for your Power Within journey.</p>
          <div className="portal-entry-trust" aria-label="Portal privacy features">
            <span>Private by design</span>
            <span>Client-only access</span>
            <span>Guided by Power Within</span>
          </div>
        </div>

        <article className="portal-entry-card">
          <header>
            <p className="eyebrow">Client Login</p>
            <h2>Welcome back</h2>
            <p>Use the email and password you created when you first accepted your private portal invitation.</p>
          </header>

          {status.message && (
            <div className={`portal-entry-alert ${status.state === 'error' ? 'is-error' : 'is-notice'}`} role={status.state === 'error' ? 'alert' : 'status'}>
              {status.message}
            </div>
          )}

          <form className="portal-entry-form" onSubmit={handleSubmit}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@email.com" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your private password" required />
            </label>
            <button type="submit" disabled={status.state === 'loading'}>
              {status.state === 'loading' ? 'Signing In…' : 'Enter My Portal'}
            </button>
          </form>

          <div className="portal-entry-support">
            <button type="button" onClick={handleForgotPassword}>Forgot password?</button>
            <Link to="/contact">Need help accessing your portal?</Link>
          </div>

          <p className="portal-entry-new-client">New here? Your portal begins through a private invitation link from Power Within.</p>
          <Link className="portal-entry-return" to="/">← Return to Power Within</Link>
        </article>
      </section>
    </main>
  )
}

export default ClientPortalLogin
