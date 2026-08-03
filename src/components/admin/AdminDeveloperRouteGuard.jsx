import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { checkDeveloperAccess, hasFreshAdminAccess } from '../../lib/nativeApi'
import AdminAccessScreen from './AdminAccessScreen.jsx'

export default function AdminDeveloperRouteGuard({ children }) {
  const [status, setStatus] = useState(() => (
    hasFreshAdminAccess('developer') ? 'allowed' : 'checking'
  ))
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
      <AdminAccessScreen
        eyebrow="Developer Access"
        title="Opening the Control Center"
        message="Confirming protected developer access."
      />
    )
  }

  if (status === 'login') {
    return <Navigate to="/admin/login" replace />
  }

  if (status === 'blocked') {
    return (
      <AdminAccessScreen
        eyebrow="Restricted Area"
        title="Developer access only."
        message={message || 'This control center is reserved for the developer account.'}
      >
        <Link className="pwc-admin-back-link" to="/admin/dashboard">
          Return to The Studio
        </Link>
      </AdminAccessScreen>
    )
  }

  return children
}
