import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin } from '../../lib/nativeApi'

import './Admin.css'
function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const requestedPath = location.state?.from
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    message: '',
  })

  useEffect(() => {
    document.body.classList.add('admin-app-mode')

    return () => {
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setStatus({
      loading: false,
      error: '',
      message: '',
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setStatus({
      loading: true,
      error: '',
      message: '',
    })

    try {
      const result = await loginAdmin(form)

      sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))

      const destination = requestedPath?.startsWith('/admin/')
        ? requestedPath
        : result.user?.role === 'owner'
          ? '/admin/founders-view'
          : '/admin/dashboard'

      setStatus({
        loading: false,
        error: '',
        message:
          result.user?.role === 'owner'
            ? 'Login successful. Opening Founder’s View...'
            : 'Login successful. Opening The Studio...',
      })

      navigate(destination)
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message || 'Login failed.',
        message: '',
      })
    }
  }

  return (
    <main className="pwc-admin-auth-page">
      <section className="pwc-admin-auth-card">
        <p className="eyebrow">Admin Access</p>
        <h1>Power Within Admin</h1>
        <p>
          Sign in to manage sessions, clients, messages, resources, and private portal access.
        </p>

        <form className="pwc-admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="owner@email.com"
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          {status.error && (
            <p className="pwc-admin-form-error" role="alert">
              {status.error}
            </p>
          )}

          {status.message && (
            <p className="pwc-admin-form-success">
              {status.message}
            </p>
          )}

          <button className="btn primary" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="pwc-admin-auth-actions">
          <Link className="btn secondary" to="/">
            Return to Website
          </Link>
        </div>
      </section>
    </main>
  )
}

export default AdminLogin
