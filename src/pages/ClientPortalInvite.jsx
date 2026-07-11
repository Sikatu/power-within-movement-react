import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  acceptPublicClientPortalInvite,
  getPublicClientPortalInvite,
} from '../lib/nativeApi'

import './ClientPortal.css'
function formatDateTime(value) {
  if (!value) return 'Not available'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function getInviteStatusCopy(status) {
  const currentStatus = String(status || '').toLowerCase()

  if (currentStatus === 'pending') {
    return {
      eyebrow: 'Private Setup',
      title: 'Set up your client portal access.',
      body:
        'Create your private password once. After this, you will return through the Client Portal Login page.',
      canAccept: true,
      canLogin: false,
      canContact: false,
    }
  }

  if (currentStatus === 'accepted') {
    return {
      eyebrow: 'Portal Active',
      title: 'Your portal is already active.',
      body:
        'This invitation has already been accepted. Please sign in with the email and password you created.',
      canAccept: false,
      canLogin: true,
      canContact: false,
    }
  }

  if (currentStatus === 'expired') {
    return {
      eyebrow: 'Expired Invite',
      title: 'This invitation has expired.',
      body:
        'For your privacy, setup links expire. You can try logging in if your portal is already active, or contact Power Within for a fresh access link.',
      canAccept: false,
      canLogin: true,
      canContact: true,
    }
  }

  if (currentStatus === 'revoked') {
    return {
      eyebrow: 'Inactive Invite',
      title: 'This invitation is no longer active.',
      body:
        'This setup link has been replaced or revoked. You can try logging in if your portal is already active, or contact Power Within for help.',
      canAccept: false,
      canLogin: true,
      canContact: true,
    }
  }

  return {
    eyebrow: 'Invite Unavailable',
    title: 'This invitation is not available.',
    body:
      'Please contact Power Within if you need help with your private client portal access.',
    canAccept: false,
    canLogin: true,
    canContact: true,
  }
}

function getInviteStatus(invite) {
  return String(invite?.status || '').toLowerCase()
}

function getInviteHeroCopy(invite, statusCopy) {
  const status = getInviteStatus(invite)

  if (status === 'pending') {
    return {
      title: 'Welcome, ' + (invite?.client?.name || 'there') + '.',
      body:
        'Create your private client portal password. This prepares your access for future session notes, resources, reminders, and client care from Power Within.',
    }
  }

  if (status === 'accepted') {
    return {
      title: 'Welcome back, ' + (invite?.client?.name || 'there') + '.',
      body:
        'Your Client Portal is already active. Use the login page to return to your private notes, resources, reminders, and care from Power Within.',
    }
  }

  return {
    title: statusCopy.title,
    body: statusCopy.body,
  }
}

function getFriendlyInviteError(message) {
  const normalizedMessage = String(message || '').toLowerCase()

  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('load failed')
  ) {
    return 'We could not open this invitation for a moment. Please refresh the page or try again shortly.'
  }

  if (
    normalizedMessage.includes('expired') ||
    normalizedMessage.includes('inactive') ||
    normalizedMessage.includes('revoked')
  ) {
    return 'This invitation link is no longer active. Please contact Power Within Collective for a fresh private portal invitation.'
  }

  return message || 'We could not open this invitation yet. Please try again shortly.'
}

export default function ClientPortalInvite() {
  const { token } = useParams()
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    document.body.classList.add('client-portal-mode')

    return () => {
      document.body.classList.remove('client-portal-mode')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInvite() {
      try {
        setIsLoading(true)
        setError('')
        setSuccessMessage('')

        const response = await getPublicClientPortalInvite(token)

        if (!isMounted) return

        setInvite(response.invite)
      } catch (loadError) {
        if (!isMounted) return

        setInvite({
          status: 'unavailable',
          client: {
            name: 'there',
          },
        })
        setError(loadError.message || 'Unable to open this invitation.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadInvite()

    return () => {
      isMounted = false
    }
  }, [token])

  const statusCopy = useMemo(
    () => getInviteStatusCopy(invite?.status),
    [invite?.status],
  )

  const heroCopy = useMemo(
    () => getInviteHeroCopy(invite, statusCopy),
    [invite, statusCopy],
  )

  const canAccept = statusCopy.canAccept

  async function handleSubmit(event) {
    event.preventDefault()

    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    try {
      const response = await acceptPublicClientPortalInvite(token, {
        password,
        confirmPassword,
      })

      setInvite(response.invite)
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage(
        response.message ||
          'Your client portal access has been created successfully.',
      )
    } catch (submitError) {
      setError(submitError.message || 'Unable to complete portal setup.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayError = getFriendlyInviteError(error)

  return (
    <main className="client-portal-invite-page-v1">
      <section className="client-portal-invite-shell-v1">
        <div className="client-portal-invite-copy-v1">
          <p className="eyebrow">Power Within Client Portal</p>
          <h1>{heroCopy.title}</h1>
          <p>{heroCopy.body}</p>
        </div>

        <div className="client-portal-invite-card-v1">
          {isLoading ? (
            <div className="client-portal-state-v1">
              Opening your invitation...
            </div>
          ) : error && !invite ? (
            <div className="client-portal-state-v1 is-error">{displayError}</div>
          ) : (
            <>
              <div className="client-portal-card-heading-v1">
                <span>{statusCopy.eyebrow}</span>
                <h2>{statusCopy.title}</h2>
                <p>
                  Invitation for <strong>{invite?.client?.email}</strong>
                </p>
                {canAccept && (
                  <p>Expires: {formatDateTime(invite?.expiresAt)}</p>
                )}
              </div>

              {error && <div className="client-portal-alert-v1">{displayError}</div>}

              {successMessage && (
                <div className="client-portal-alert-v1 is-success">
                  <span>{successMessage}</span>

                  <div className="client-portal-success-actions-v1">
                    <Link
                      className="client-portal-inline-action-v1"
                      to="/client-portal/login"
                    >
                      Go to Client Portal Login
                    </Link>
                  </div>
                </div>
              )}

              {canAccept ? (
                <form
                  className="client-portal-form-v1"
                  onSubmit={handleSubmit}
                >
                  <label>
                    <span>Create Password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={12}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                      title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
                      autoComplete="new-password"
                      required
                    />
                  </label>

                  <label>
                    <span>Confirm Password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      minLength={12}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                      title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
                      autoComplete="new-password"
                      required
                    />
                  </label>

                  <p className="client-portal-password-help-v3">
                    Use at least 12 characters with an uppercase letter, lowercase letter,
                    number, and symbol.
                  </p>

                  <button type="submit" disabled={isSaving}>
                    {isSaving ? 'Creating Access...' : 'Create My Portal Access'}
                  </button>
                </form>
              ) : (
                <div className="client-portal-state-v1 client-portal-invite-status-v1">
                  <span>{statusCopy.eyebrow}</span>
                  <strong>{statusCopy.title}</strong>
                  <p>{statusCopy.body}</p>

                  <div className="client-portal-success-actions-v1">
                    {statusCopy.canLogin && (
                      <Link
                        className="client-portal-inline-action-v1"
                        to="/client-portal/login"
                      >
                        Go to Client Portal Login
                      </Link>
                    )}

                    {statusCopy.canContact && (
                      <Link
                        className="client-portal-inline-action-v1 is-secondary"
                        to="/contact"
                      >
                        Contact Power Within
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

