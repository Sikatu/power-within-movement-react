import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  changeRequiredPassword,
  getPasswordChangeStatus,
} from '../../lib/nativeApi'

import './Admin.css'

const initialForm = {
  newPassword: '',
  confirmPassword: '',
}

function AdminChangePassword() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({
    checking: true,
    loading: false,
    error: '',
    message: '',
  })

  useEffect(() => {
    document.body.classList.add('admin-app-mode')

    let active = true

    getPasswordChangeStatus()
      .then((result) => {
        if (!active) return
        setAccount(result.user)
        setStatus((current) => ({
          ...current,
          checking: false,
          error: '',
        }))
      })
      .catch((error) => {
        if (!active) return
        navigate('/admin/login', {
          replace: true,
          state: {
            notice:
              error.message ||
              'Your password-change session expired. Sign in again with the temporary password.',
          },
        })
      })

    return () => {
      active = false
      document.body.classList.remove('admin-app-mode')
    }
  }, [navigate])

  const requirements = useMemo(
    () => [
      { label: 'At least 12 characters', met: form.newPassword.length >= 12 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(form.newPassword) },
      { label: 'One lowercase letter', met: /[a-z]/.test(form.newPassword) },
      { label: 'One number', met: /[0-9]/.test(form.newPassword) },
      { label: 'One symbol', met: /[^A-Za-z0-9]/.test(form.newPassword) },
      {
        label: 'Both passwords match',
        met:
          form.confirmPassword.length > 0 &&
          form.newPassword === form.confirmPassword,
      },
    ],
    [form],
  )

  const formIsReady = requirements.every((requirement) => requirement.met)

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setStatus((current) => ({
      ...current,
      error: '',
      message: '',
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formIsReady) {
      setStatus((current) => ({
        ...current,
        error: 'Please complete every password requirement.',
      }))
      return
    }

    setStatus((current) => ({
      ...current,
      loading: true,
      error: '',
      message: '',
    }))

    try {
      const result = await changeRequiredPassword(form)

      sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))

      setStatus((current) => ({
        ...current,
        loading: false,
        message: 'Your permanent password is ready. Opening your portal...',
      }))

      navigate(
        result.user?.role === 'owner'
          ? '/admin/founders-view'
          : '/admin/dashboard',
        { replace: true },
      )
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: error.message || 'The password could not be changed.',
      }))
    }
  }

  if (status.checking) {
    return (
      <main className="pwc-admin-auth-page">
        <section className="pwc-admin-auth-card pwc-admin-password-card">
          <p className="eyebrow">Secure Setup</p>
          <h1>Preparing your account</h1>
          <p>Confirming your temporary sign-in session...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="pwc-admin-auth-page">
      <section className="pwc-admin-auth-card pwc-admin-password-card">
        <p className="eyebrow">Welcome to Power Within</p>
        <h1>Create your private password</h1>
        <p>
          For your security, please replace the temporary password before entering
          Founder’s View.
        </p>

        {account?.email && (
          <p className="pwc-admin-account-email">
            Account: <strong>{account.email}</strong>
          </p>
        )}

        <form className="pwc-admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={handleChange}
            placeholder="Create a permanent password"
            required
          />

          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Enter the new password again"
            required
          />

          <div className="pwc-admin-password-requirements" aria-live="polite">
            <p>Password requirements</p>
            <ul>
              {requirements.map((requirement) => (
                <li
                  className={requirement.met ? 'is-met' : ''}
                  key={requirement.label}
                >
                  <span aria-hidden="true">{requirement.met ? '✓' : '○'}</span>
                  {requirement.label}
                </li>
              ))}
            </ul>
          </div>

          {status.error && (
            <p className="pwc-admin-form-error" role="alert">
              {status.error}
            </p>
          )}

          {status.message && (
            <p className="pwc-admin-form-success">{status.message}</p>
          )}

          <button
            className="btn primary"
            type="submit"
            disabled={status.loading || !formIsReady}
          >
            {status.loading ? 'Creating Password...' : 'Create My Password'}
          </button>
        </form>

        <div className="pwc-admin-auth-actions">
          <Link className="btn secondary" to="/admin/login">
            Return to Sign In
          </Link>
        </div>
      </section>
    </main>
  )
}

export default AdminChangePassword
