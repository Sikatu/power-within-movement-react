import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoImage from '../../assets/images/logo.webp'
import { loginAdmin } from '../../lib/nativeApi'

import './AdminFreshUI.css'

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
    message: location.state?.notice || '',
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

      if (result.passwordChangeRequired) {
        sessionStorage.removeItem('pwc_admin_user')
        navigate('/admin/change-password', {
          replace: true,
          state: { email: result.user?.email },
        })
        return
      }

      sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))

      const destination = requestedPath?.startsWith('/admin/')
        ? requestedPath
        : result.user?.role === 'developer'
          ? '/admin/developer'
          : result.user?.role === 'owner'
            ? '/admin/founders-view'
            : '/admin/dashboard'

      setStatus({
        loading: false,
        error: '',
        message:
          result.user?.role === 'developer'
            ? 'Login successful. Opening the Developer Control Center...'
            : result.user?.role === 'owner'
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
        <img className="pwc-admin-auth-logo" src={logoImage} alt="Power Within Collective" />
        <p className="eyebrow">Power Within</p>
        <h1>The Studio</h1>
        <p>A private space for meaningful transformation.</p>

        <form className="pwc-admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="kim@kimmittelstadt.com"
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
            {status.loading ? 'Opening The Studio…' : 'Enter The Studio'}
          </button>
        </form>

        <div className="pwc-admin-auth-actions">
          <Link to="/">View public site</Link>
        </div>

        <p className="pwc-admin-auth-footer">Private access · Power Within Movement, LLC</p>
      </section>
    </main>
  )
}

export default AdminLogin
