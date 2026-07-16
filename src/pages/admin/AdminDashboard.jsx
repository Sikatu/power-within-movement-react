import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  checkAdminAccess,
  getAdminAuditLogs,
  getAdminBookings,
  getAdminClients,
  getAdminFollowUps,
  getAdminOverview,
} from '../../lib/nativeApi'

function getList(response, keys) {
  if (Array.isArray(response)) return response

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
  }

  return []
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function formatDate(value) {
  if (!value) return 'No date'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()
}

function getFollowUpTone(item, now) {
  if (!item?.follow_up_at) return 'unscheduled'

  const dueTime = new Date(item.follow_up_at).getTime()

  if (Number.isNaN(dueTime)) return 'unscheduled'

  if (dueTime < now.getTime()) return 'overdue'

  const twoDaysFromNow = now.getTime() + 1000 * 60 * 60 * 24 * 2

  if (dueTime <= twoDaysFromNow) return 'due-soon'

  return 'scheduled'
}

function normalizeBooking(booking) {
  return {
    ...booking,
    title:
      booking.appointment_type_name ||
      booking.appointmentTypeName ||
      'Session Request',
    guestName:
      booking.guest_name ||
      booking.guestName ||
      booking.client_name ||
      'Guest',
    startsAt: booking.starts_at || booking.startsAt,
    status: booking.status || 'requested',
  }
}

function normalizeAuditLog(log) {
  return {
    ...log,
    action: log.action || 'activity',
    createdAt: log.created_at || log.createdAt,
    actorEmail: log.actor_email || log.actorEmail || 'Studio',
  }
}

export default function AdminDashboard() {
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('pwc_admin_user') || 'null')
    } catch {
      return null
    }
  })
  const [overview, setOverview] = useState(null)
  const [clients, setClients] = useState([])
  const [bookings, setBookings] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [followUpStats, setFollowUpStats] = useState({
    total: 0,
    overdue: 0,
    due_soon: 0,
    unscheduled: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [studioNow] = useState(() => new Date())

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        setIsLoading(true)
        setError('')

        await checkAdminAccess()

        const [
          overviewResponse,
          clientsResponse,
          bookingsResponse,
          auditResponse,
          followUpsResponse,
        ] = await Promise.all([
          getAdminOverview().catch(() => null),
          getAdminClients().catch(() => null),
          getAdminBookings().catch(() => null),
          getAdminAuditLogs().catch(() => null),
          getAdminFollowUps().catch(() => null),
        ])

        if (!isMounted) return

        setOverview(overviewResponse)

        setClients(
          getList(clientsResponse, ['clients', 'clientProfiles', 'records']),
        )

        setBookings(
          getList(bookingsResponse, ['bookings', 'records']).map(
            normalizeBooking,
          ),
        )

        setAuditLogs(
          getList(auditResponse, ['auditLogs', 'logs', 'records']).map(
            normalizeAuditLog,
          ),
        )

        setFollowUps(getList(followUpsResponse, ['followUps', 'records']))

        setFollowUpStats(
          followUpsResponse?.stats || {
            total: 0,
            overdue: 0,
            due_soon: 0,
            unscheduled: 0,
          },
        )
      } catch (loadError) {
        if (!isMounted) return

        setError(loadError.message || 'Unable to load The Studio dashboard.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const pendingBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        ['requested', 'pending', 'approved'].includes(
          String(booking.status || '').toLowerCase(),
        ),
      ),
    [bookings],
  )

  const dashboardMetrics = useMemo(
    () => [
      {
        label: 'Client Circle',
        value: clients.length,
        detail: 'Private client records',
        href: '/admin/clients',
      },
      {
        label: 'Needs Follow-Up',
        value: followUpStats.total || followUps.length,
        detail: `${followUpStats.overdue || 0} overdue`,
        href: '/admin/clients',
      },
      {
        label: 'Open Sessions',
        value: pendingBookings.length,
        detail: 'Requests and active care',
        href: '/admin/scheduler',
      },
      {
        label: 'Journal Events',
        value: auditLogs.length,
        detail: 'Recent studio activity',
        href: '/admin/audit-log',
      },
    ],
    [
      auditLogs.length,
      clients.length,
      followUpStats.overdue,
      followUpStats.total,
      followUps.length,
      pendingBookings.length,
    ],
  )

  const nextBookings = useMemo(
    () =>
      [...bookings]
        .filter((booking) => booking.startsAt)
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        .slice(0, 5),
    [bookings],
  )

  const recentAuditLogs = auditLogs.slice(0, 6)
  const urgentFollowUps = followUps.slice(0, 8)

  return (
    <AdminFrame>
      <div className="studio-dashboard-v3">
        <header className="studio-hero-v3">
          <div>
            <p className="admin-eyebrow">The Studio</p>
            <h1>Welcome back, {adminUser?.role === 'developer' ? 'Developer' : adminUser?.role === 'owner' ? 'Kim' : 'Studio Team'}.</h1>
            <p>
              See what needs care today, then move directly into the right workspace.
            </p>
          </div>

          <div className="studio-focus-card-v3">
            <span>Today&apos;s priority</span>
            <strong>
              {followUpStats.total > 0
                ? 'Care follow-ups are waiting.'
                : 'The studio is clear.'}
            </strong>
            <p>
              {followUpStats.total > 0
                ? `${followUpStats.total} service record(s) need follow-up attention.`
                : 'No active follow-up service records are waiting right now.'}
            </p>
            <div className="studio-focus-actions-v4">
              <Link to="/admin/clients">Open clients</Link>
              <Link to="/admin/scheduler">Review sessions</Link>
            </div>
          </div>
        </header>

        {error && <div className="studio-message-v3 is-error">{error}</div>}

        {isLoading ? (
          <div className="studio-message-v3">Loading The Studio...</div>
        ) : (
          <>
            <section className="studio-metrics-v3">
              {dashboardMetrics.map((metric) => (
                <Link key={metric.label} to={metric.href}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.detail}</p>
                </Link>
              ))}
            </section>

            <section className="studio-followups-v3">
              <div className="studio-section-heading-v3">
                <div>
                  <p className="admin-eyebrow">Needs Your Care</p>
                  <h2>Follow-Up Care Queue</h2>
                </div>

                <a href="/admin/clients">Open Client Circle</a>
              </div>

              {urgentFollowUps.length === 0 ? (
                <div className="studio-empty-v3">
                  No active follow-up records. Mark a service record as
                  Follow-Up inside a client profile to bring it here.
                </div>
              ) : (
                <div className="studio-followup-grid-v3">
                  {urgentFollowUps.map((item) => {
                    const tone = getFollowUpTone(item, studioNow)

                    return (
                      <article
                        key={item.id}
                        className={`studio-followup-card-v3 is-${tone}`}
                      >
                        <div>
                          <span>{item.due_status || formatLabel(tone)}</span>
                          <h3>{item.title || item.service_name}</h3>
                          <p>
                            {item.summary ||
                              item.notes ||
                              item.private_notes ||
                              'No summary saved yet.'}
                          </p>
                        </div>

                        <div className="studio-followup-meta-v3">
                          <strong>{item.client_name || 'Unnamed Client'}</strong>
                          <time>{formatDateTime(item.follow_up_at)}</time>
                          <a href={`/admin/clients?clientId=${item.client_profile_id}`}>
                            Open Client
                          </a>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="studio-dashboard-grid-v3">
              <article className="studio-panel-v3">
                <div className="studio-section-heading-v3">
                  <div>
                    <p className="admin-eyebrow">Sessions</p>
                    <h2>Coming Up</h2>
                  </div>

                  <a href="/admin/scheduler">Open Scheduler</a>
                </div>

                {nextBookings.length === 0 ? (
                  <p className="studio-empty-v3">No upcoming sessions yet.</p>
                ) : (
                  <div className="studio-list-v3">
                    {nextBookings.map((booking) => (
                      <article key={booking.id}>
                        <div>
                          <strong>{booking.title}</strong>
                          <span>{booking.guestName}</span>
                        </div>

                        <time>{formatDateTime(booking.startsAt)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <article className="studio-panel-v3">
                <div className="studio-section-heading-v3">
                  <div>
                    <p className="admin-eyebrow">Activity Journal</p>
                    <h2>Recent Movement</h2>
                  </div>

                  <a href="/admin/audit-log">Open Journal</a>
                </div>

                {recentAuditLogs.length === 0 ? (
                  <p className="studio-empty-v3">No recent activity yet.</p>
                ) : (
                  <div className="studio-list-v3">
                    {recentAuditLogs.map((log) => (
                      <article key={log.id}>
                        <div>
                          <strong>{formatLabel(log.action)}</strong>
                          <span>{log.actorEmail}</span>
                        </div>

                        <time>{formatDate(log.createdAt)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>

            {overview?.message && (
              <div className="studio-message-v3">{overview.message}</div>
            )}
          </>
        )}
      </div>
    </AdminFrame>
  )
}
