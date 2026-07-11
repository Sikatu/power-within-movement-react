import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getClientPortalMe, loginClientPortal } from '../lib/nativeApi'

import './ClientPortal.css'
function getFriendlyLoginError(message) {
  const normalizedMessage = String(message || '').toLowerCase()

  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('load failed')
  ) {
    return 'We could not connect to the private portal for a moment. Please check your connection and try again.'
  }

  if (
    normalizedMessage.includes('invalid') ||
    normalizedMessage.includes('incorrect') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('401')
  ) {
    return 'The email or password did not match an active client portal account.'
  }

  return message || 'We could not sign you in yet. Please try again shortly.'
}

export default function ClientPortalLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.body.classList.add('client-portal-mode')

    return () => {
      document.body.classList.remove('client-portal-mode')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function redirectClientIfAlreadyLoggedIn() {
      try {
        await getClientPortalMe()

        if (isMounted) {
          navigate('/client-portal/home', { replace: true })
        }
      } catch {
        // Not logged in yet. Stay on the login page.
      }
    }

    redirectClientIfAlreadyLoggedIn()

    return () => {
      isMounted = false
    }
  }, [navigate])

  async function handleSubmit(event) {
    event.preventDefault()

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      await loginClientPortal({
        email: email.trim().toLowerCase(),
        password,
      })

      navigate('/client-portal/home')
    } catch (loginError) {
      setError(
        loginError.message ||
          'We could not sign you in. Please check your email and password.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleForgotPassword() {
    setError('')
    setNotice(
      'Password reset is not automated yet. Please contact Power Within so your portal access can be safely restored.',
    )
  }

  const displayError = getFriendlyLoginError(error)

  return (
    <main className="client-portal-login-page-v1">
      <section className="client-portal-login-shell-v1">
        <div className="client-portal-invite-copy-v1">
          <p className="eyebrow">Power Within Client Portal</p>
          <h1>Your private space for care.</h1>
          <p>
            Sign in to return to your private notes, resources, session history,
            reminders, and client care prepared for your Power Within journey.
          </p>

          <div className="client-portal-login-privacy-v2">
            <span>Private by design</span>
            <span>Client-only access</span>
            <span>Guided by Power Within</span>
          </div>
        </div>

        <div className="client-portal-invite-card-v1 client-portal-login-card-v2">
          <div className="client-portal-card-heading-v1">
            <span>Client Login</span>
            <h2>Welcome back</h2>
            <p>
              Use the email and password you created when you first accepted
              your private portal invitation.
            </p>
          </div>

          {error && <div className="client-portal-alert-v1">{displayError}</div>}

          {notice && (
            <div className="client-portal-alert-v1 is-success">{notice}</div>
          )}

          <form className="client-portal-form-v1" onSubmit={handleSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@email.com"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Your private password"
                required
              />
            </label>

            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Signing In...' : 'Enter My Portal'}
            </button>
          </form>

          <div className="client-portal-login-support-v2">
            <button type="button" onClick={handleForgotPassword}>
              Forgot password?
            </button>

            <Link to="/contact">Need help accessing your portal?</Link>
          </div>

          <div className="client-portal-login-meta-v2">
            <p>
              New here? Your portal begins through a private invitation link
              from Power Within.
            </p>
          </div>

          <Link className="client-portal-return-link-v1" to="/">
            Return to Power Within
          </Link>
        </div>
      </section>
    </main>
  )
}

