import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { checkDeveloperAccess } from '../../lib/nativeApi'

export default function AdminDeveloperRouteGuard({ children }) {
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function verifyDeveloperAccess() {
      try {
        const result = await checkDeveloperAccess()

        if (!isMounted) return

        if (result?.user) {
          sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))
        }

        setStatus('allowed')
      } catch (error) {
        if (!isMounted) return

        const errorMessage = error.message || 'Developer access required.'
        const lowerMessage = errorMessage.toLowerCase()

        if (
          lowerMessage.includes('authentication') ||
          lowerMessage.includes('expired') ||
          lowerMessage.includes('login')
        ) {
          setStatus('login')
          return
        }

        setMessage(errorMessage)
        setStatus('blocked')
      }
    }

    verifyDeveloperAccess()

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'checking') {
    return (
      <main className="pwc-admin-auth-screen">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Developer Access</p>
          <h1>Opening the Control Center</h1>
          <p>Confirming protected developer access.</p>
        </section>
      </main>
    )
  }

  if (status === 'login') {
    return <Navigate to="/admin/login" replace />
  }

  if (status === 'blocked') {
    return (
      <main className="pwc-admin-auth-screen">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Restricted Area</p>
          <h1>Developer access only.</h1>
          <p>{message || 'This control center is reserved for the developer account.'}</p>

          <Link className="pwc-admin-back-link" to="/admin/dashboard">
            Return to The Studio
          </Link>
        </section>
      </main>
    )
  }

  return children
}
