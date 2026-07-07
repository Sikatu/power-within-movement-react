import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { checkFounderAccess } from '../../lib/nativeApi'

export default function AdminOwnerRouteGuard({ children }) {
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function verifyFounderAccess() {
      try {
        await checkFounderAccess()

        if (isMounted) {
          setStatus('allowed')
        }
      } catch (error) {
        if (!isMounted) return

        const errorMessage = error.message || 'Founder access required.'
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

    verifyFounderAccess()

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'checking') {
    return (
      <main className="pwc-admin-auth-screen">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Founder Access</p>
          <h1>Checking permission...</h1>
          <p>Opening The Founder&apos;s View securely.</p>
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
          <p className="eyebrow">Restricted View</p>
          <h1>Founder access only.</h1>
          <p>
            {message ||
              'The Founder&apos;s View is reserved for the owner account. Please return to The Studio.'}
          </p>

          <Link className="pwc-admin-back-link" to="/admin/dashboard">
            Return to The Studio
          </Link>
        </section>
      </main>
    )
  }

  return children
}
