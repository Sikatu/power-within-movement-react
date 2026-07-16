import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { checkAdminAccess } from '../../lib/nativeApi'

function AdminRouteGuard({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState('checking')

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
      <main className="pwc-admin-auth-page">
        <section className="pwc-admin-auth-card">
          <p className="eyebrow">Studio Access</p>
          <h1>Opening The Studio</h1>
          <p>Confirming private access before continuing.</p>
        </section>
      </main>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default AdminRouteGuard
