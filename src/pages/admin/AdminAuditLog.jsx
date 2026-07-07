import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import { checkAdminAccess, getAdminAuditLogs } from '../../lib/nativeApi'

function readableAction(value) {
  if (!value) return 'Unknown Action'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readableEntity(value) {
  if (!value) return '-'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function summarizeData(data) {
  if (!data) return '-'

  const entries = Object.entries(data)

  if (entries.length === 0) return '-'

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value ?? '-')}`)
    .join('  ')
}

function AdminAuditLog() {
  const [auditLogs, setAuditLogs] = useState([])
  const [status, setStatus] = useState({
    loading: true,
    error: '',
    message: 'Loading audit log...',
  })

  useEffect(() => {
    document.body.classList.add('admin-app-mode')

    return () => {
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadAuditLogs() {
      try {
        await checkAdminAccess()
        const result = await getAdminAuditLogs()

        if (!isMounted) return

        setAuditLogs(result.auditLogs || [])
        setStatus({
          loading: false,
          error: '',
          message: '',
        })
      } catch (error) {
        if (!isMounted) return

        setAuditLogs([])
        setStatus({
          loading: false,
          error: error.message || 'Unable to load audit logs.',
          message: '',
        })
      }
    }

    loadAuditLogs()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <AdminFrame>
      <div className="pwc-admin-page-header pwc-admin-page-header-balanced">
        <div>
          <p className="eyebrow">Studio Memory</p>
          <h1>Activity Journal</h1>
          <p>
            Review the quiet record of client care, profile changes, created records,
            updated records, and studio activity. This gives your client visibility
            into what changed and when it happened.
          </p>
        </div>

        <Link className="btn primary" to="/admin/dashboard">
          The Studio
        </Link>
      </div>

      <div className="pwc-admin-metrics-grid pwc-admin-metrics-compact">
        <article>
          <span>Journal Entries</span>
          <strong>{auditLogs.length}</strong>
        </article>
        <article>
          <span>Source</span>
          <strong>Database</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{status.loading ? 'Loading' : 'Live'}</strong>
        </article>
      </div>

      {status.error && (
        <section className="pwc-admin-locked-card">
          <p className="eyebrow">Access Needed</p>
          <h2>The Activity Journal is protected.</h2>
          <p>{status.error}</p>
          <Link className="btn primary" to="/admin">
            Go to Admin Login
          </Link>
        </section>
      )}

      {!status.error && (
        <section className="pwc-admin-table-card pwc-admin-audit-card">
          <div className="pwc-admin-table-header">
            <div>
              <p className="eyebrow">Studio Activity</p>
              <h2>Activity Journal</h2>
            </div>
            <span>{status.loading ? 'Loading...' : `${auditLogs.length} event(s)`}</span>
          </div>

          <div className="pwc-admin-table-scroll">
            <table className="pwc-admin-table pwc-admin-audit-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>After Data</th>
                  <th>Time</th>
                </tr>
              </thead>

              <tbody>
                {auditLogs.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{readableAction(event.action)}</strong>
                    </td>
                    <td>
                      <span>{event.actor_email || 'System'}</span>
                      <small>{event.actor_role || '-'}</small>
                    </td>
                    <td>
                      <span>{readableEntity(event.entity_type)}</span>
                      <small>{event.entity_id || '-'}</small>
                    </td>
                    <td>{summarizeData(event.after_data)}</td>
                    <td>{formatDateTime(event.created_at)}</td>
                  </tr>
                ))}

                {!status.loading && auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="5">No audit events yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminFrame>
  )
}

export default AdminAuditLog