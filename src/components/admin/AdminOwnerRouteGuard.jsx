import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { checkFounderAccess } from '../../lib/nativeApi'

export default function AdminOwnerRouteGuard({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function verifyFounderAccess() {
      try {
        const result = await checkFounderAccess()

        if (result?.user) {
          sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))
        }

        if (result?.founderOwner) {
          sessionStorage.setItem(
            'pwc_founder_workspace_owner',
            JSON.stringify(result.founderOwner),
          )
        }

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
  }, [location.pathname])

  if (status === 'checking') {
    return (
      <main className="pwc-admin-auth-screen">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Founder Workspace</p>
          <h1>Checking permission...</h1>
          <p>Opening the live Founder workspace securely.</p>
        </section>
      </main>
    )
  }

  if (status === 'login') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (status === 'blocked') {
    return (
      <main className="pwc-admin-auth-screen">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Restricted Workspace</p>
          <h1>Owner or developer access required.</h1>
          <p>
            {message ||
              'The live Founder workspace is available only to the owner and developer accounts.'}
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
