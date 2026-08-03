import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { checkFounderAccess, hasFreshAdminAccess } from '../../lib/nativeApi'
import AdminAccessScreen from './AdminAccessScreen.jsx'

export default function AdminOwnerRouteGuard({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState(() => (
    hasFreshAdminAccess('founder') ? 'allowed' : 'checking'
  ))
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
      <AdminAccessScreen
        eyebrow="Founder Workspace"
        title="Checking permission..."
        message="Opening the live Founder workspace securely."
      />
    )
  }

  if (status === 'login') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (status === 'blocked') {
    return (
      <AdminAccessScreen
        eyebrow="Restricted Workspace"
        title="Owner or developer access required."
        message={message || 'The live Founder workspace is available only to the owner and developer accounts.'}
      >
        <Link className="pwc-admin-back-link" to="/admin/dashboard">
          Return to The Studio
        </Link>
      </AdminAccessScreen>
    )
  }

  return children
}
