import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { checkAdminAccess, hasFreshAdminAccess } from '../../lib/nativeApi'
import AdminAccessScreen from './AdminAccessScreen.jsx'

function AdminRouteGuard({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState(() => (
    hasFreshAdminAccess() ? 'allowed' : 'checking'
  ))

  useEffect(() => {
    let isMounted = true

    async function verifyAccess() {
      try {
        const result = await checkAdminAccess()

        if (result?.user) {
          sessionStorage.setItem('pwc_admin_user', JSON.stringify(result.user))
        }

        if (isMounted) setStatus('allowed')
      } catch {
        sessionStorage.removeItem('pwc_admin_user')
        if (isMounted) setStatus('denied')
      }
    }

    verifyAccess()

    return () => {
      isMounted = false
    }
  }, [location.pathname])

  if (status === 'checking') {
    return (
      <AdminAccessScreen
        eyebrow="Studio Access"
        title="Opening The Studio"
        message="Confirming private access before continuing."
      />
    )
  }

  if (status === 'denied') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default AdminRouteGuard
