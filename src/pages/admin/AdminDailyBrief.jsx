import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import {
  getAdminAttentionQueue,
  getAdminBookings,
  getAdminNotifications,
  getMyTeamAccess,
  markAdminNotificationRead,
} from '../../lib/nativeApi.js'

const DAY_MS = 86_400_000

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function roleLabel(role) {
  return {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }[role] || 'Private account'
}

function firstName(user) {
  const candidate = user?.displayName || user?.name || user?.email || ''
  return candidate.split(/[\s@]/).filter(Boolean)[0] || 'there'
}

function formatDay(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Today'
  }
}

function formatTime(value) {
  if (!value) return 'Time not set'

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'Time unavailable'
  }
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function taskScore(task, now) {
  const priority = {
    urgent: 60,
    high: 40,
    normal: 20,
    low: 10,
  }[task.priority] || 20

  if (!task.dueAt) return priority - 5

  const due = new Date(task.dueAt).getTime()
  if (Number.isNaN(due)) return priority - 5
  if (due < startOfDay(now).getTime()) return priority + 50
  if (due <= endOfDay(now).getTime()) return priority + 35
  if (due <= now + (7 * DAY_MS)) return priority + 15
  return priority
}

function taskTiming(task, now) {
  if (!task.dueAt) return 'No due date'

  const due = new Date(task.dueAt).getTime()
  if (Number.isNaN(due)) return 'No due date'
  if (due < startOfDay(now).getTime()) return 'Overdue'
  if (due <= endOfDay(now).getTime()) return 'Due today'
  if (due <= now + (7 * DAY_MS)) return 'Due this week'
  return formatDateTime(task.dueAt)
}

function normalizeBooking(booking) {
  const startsAt = booking.starts_at || booking.startsAt
  const clientName = [booking.client_first_name, booking.client_last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    id: booking.id,
    startsAt,
    status: String(booking.status || 'requested').toLowerCase(),
    title: booking.appointment_type_name || booking.appointmentTypeName || 'Private session',
    guestName: clientName || booking.guest_name || booking.guestName || 'Guest',
    clientProfileId: booking.client_profile_id || booking.clientProfileId || null,
  }
}

function notificationMark(category) {
  return {
    inbox: 'M',
    sessions: 'S',
    resources: 'R',
    learning: 'L',
    memberships: 'P',
    encouragements: 'E',
    community: 'C',
    system: '!',
  }[category] || '•'
}

export default function AdminDailyBrief() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [teamAccess, setTeamAccess] = useState(null)
  const [tasks, setTasks] = useState([])
  const [attentionMetrics, setAttentionMetrics] = useState({})
  const [bookings, setBookings] = useState([])
  const [notifications, setNotifications] = useState([])
  const [briefClock, setBriefClock] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const role = adminUser?.role || 'staff'
  const isStaff = role === 'staff'
  const canSeeSessions = !isStaff || (teamAccess?.permissions?.sessions || 'none') !== 'none'

  const loadBrief = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')
    setNotice('')

    const results = await Promise.allSettled([
      getAdminAttentionQueue(),
      getAdminBookings(),
      getAdminNotifications({ limit: 40 }),
      isStaff ? getMyTeamAccess() : Promise.resolve(null),
    ])

    const [queueResult, bookingResult, notificationResult, accessResult] = results
    const failures = []

    if (queueResult.status === 'fulfilled') {
      setTasks(queueResult.value.tasks || [])
      setAttentionMetrics(queueResult.value.metrics || {})
    } else {
      failures.push('attention queue')
    }

    if (bookingResult.status === 'fulfilled') {
      setBookings((bookingResult.value.bookings || []).map(normalizeBooking))
    } else {
      failures.push('sessions')
    }

    if (notificationResult.status === 'fulfilled') {
      setNotifications(notificationResult.value.notifications || [])
    } else {
      failures.push('activity')
    }

    if (accessResult.status === 'fulfilled') {
      setTeamAccess(accessResult.value?.access || null)
    }

    setBriefClock(Date.now())

    if (failures.length === 3) {
      setError('Today’s Studio brief could not be loaded. Please refresh and try again.')
    } else if (failures.length) {
      setNotice(`The brief loaded with limited ${failures.join(', ')} information.`)
    }

    setLoading(false)
    setRefreshing(false)
  }, [isStaff])

  useEffect(() => {
    const timer = window.setTimeout(loadBrief, 0)
    return () => window.clearTimeout(timer)
  }, [loadBrief])

  const focusTasks = useMemo(() => (
    [...tasks]
      .sort((left, right) => (
        taskScore(right, briefClock) - taskScore(left, briefClock)
        || new Date(left.dueAt || '9999-12-31').getTime() - new Date(right.dueAt || '9999-12-31').getTime()
      ))
      .slice(0, 5)
  ), [briefClock, tasks])

  const upcomingSessions = useMemo(() => {
    if (!canSeeSessions) return []

    const start = startOfDay(briefClock).getTime()
    const end = start + (7 * DAY_MS)

    return bookings
      .filter((booking) => {
        const time = new Date(booking.startsAt).getTime()
        return Number.isFinite(time)
          && time >= start
          && time < end
          && !['cancelled', 'declined', 'completed'].includes(booking.status)
      })
      .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))
      .slice(0, 5)
  }, [bookings, briefClock, canSeeSessions])

  const todaySessions = useMemo(() => {
    const end = endOfDay(briefClock).getTime()
    return upcomingSessions.filter((booking) => new Date(booking.startsAt).getTime() <= end).length
  }, [briefClock, upcomingSessions])

  const priorityActivity = useMemo(() => (
    notifications
      .filter((notification) => !notification.readAt)
      .sort((left, right) => {
        const importance = { urgent: 3, high: 2, normal: 1 }
        return (importance[right.importance] || 0) - (importance[left.importance] || 0)
          || new Date(right.createdAt) - new Date(left.createdAt)
      })
      .slice(0, 5)
  ), [notifications])

  const metrics = useMemo(() => ({
    overdue: attentionMetrics.overdue || 0,
    dueToday: attentionMetrics.dueToday || 0,
    sessionsToday: todaySessions,
    unread: notifications.filter((notification) => !notification.readAt).length,
  }), [attentionMetrics, notifications, todaySessions])

  const calmState = metrics.overdue === 0
    && metrics.dueToday === 0
    && metrics.unread === 0

  async function openNotification(notification) {
    setError('')

    try {
      if (!notification.readAt) {
        await markAdminNotificationRead(notification.id)
        setNotifications((current) => current.map((item) => (
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item
        )))
      }

      if (!notification.actionUrl) return
      if (notification.actionUrl.startsWith('/')) navigate(notification.actionUrl)
      else window.location.assign(notification.actionUrl)
    } catch (actionError) {
      setError(actionError.message || 'This Studio update could not be opened.')
    }
  }

  return (
    <AdminFrame>
      <div className="pwc-brief15-page">
        <header className="pwc-brief15-hero">
          <div className="pwc-brief15-hero-copy">
            <p className="admin-eyebrow">Today in The Studio</p>
            <h1>Good day, {firstName(adminUser)}.</h1>
            <p className="pwc-brief15-date">{formatDay(briefClock)}</p>
            <p>
              Begin with the clearest next steps across client care, sessions,
              and recent Studio activity—without opening every workspace.
            </p>
            <div className="pwc-brief15-hero-actions">
              <button type="button" onClick={() => navigate('/admin/attention')}>
                Open attention queue
              </button>
              <button
                className="is-secondary"
                type="button"
                disabled={refreshing}
                onClick={() => loadBrief({ quiet: true })}
              >
                {refreshing ? 'Refreshing…' : 'Refresh brief'}
              </button>
            </div>
          </div>

          <aside className={`pwc-brief15-readiness${calmState ? ' is-clear' : ''}`} aria-label="Studio readiness">
            <span aria-hidden="true">{calmState ? '✓' : metrics.overdue + metrics.dueToday}</span>
            <div>
              <small>{roleLabel(role)} view</small>
              <strong>{calmState ? 'The day is clear' : 'A focused day ahead'}</strong>
              <p>
                {isStaff
                  ? 'Only work permitted for your account and assigned clients is included.'
                  : 'Your brief combines account-visible care, session, and activity signals.'}
              </p>
            </div>
          </aside>
        </header>

        {(error || notice) && (
          <div
            className={`pwc-brief15-message${error ? ' is-error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <section className="pwc-brief15-metrics" aria-label="Today’s Studio summary">
          <article className={metrics.overdue ? 'is-danger' : ''}>
            <span>Overdue</span>
            <strong>{metrics.overdue}</strong>
            <p>Attention items past due</p>
          </article>
          <article className={metrics.dueToday ? 'is-warning' : ''}>
            <span>Due today</span>
            <strong>{metrics.dueToday}</strong>
            <p>Client-care priorities</p>
          </article>
          <article>
            <span>Sessions today</span>
            <strong>{canSeeSessions ? metrics.sessionsToday : '—'}</strong>
            <p>{canSeeSessions ? 'Confirmed and open sessions' : 'Hidden by your access'}</p>
          </article>
          <article className={metrics.unread ? 'is-priority' : ''}>
            <span>Unread activity</span>
            <strong>{metrics.unread}</strong>
            <p>Updates waiting for review</p>
          </article>
        </section>

        {loading ? (
          <div className="pwc-brief15-loading" aria-label="Loading today’s Studio brief">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="pwc-brief15-grid">
            <section className="pwc-brief15-panel pwc-brief15-focus" aria-labelledby="brief-focus-title">
              <div className="pwc-brief15-panel-heading">
                <div>
                  <p className="admin-eyebrow">Priority focus</p>
                  <h2 id="brief-focus-title">The next five meaningful actions</h2>
                </div>
                <button type="button" onClick={() => navigate('/admin/attention')}>View all</button>
              </div>

              {focusTasks.length ? (
                <div className="pwc-brief15-focus-list">
                  {focusTasks.map((task, index) => (
                    <article className={`is-${task.priority}`} key={`${task.sourceType}:${task.id}`}>
                      <span className="pwc-brief15-rank" aria-label={`Priority ${index + 1}`}>{index + 1}</span>
                      <div>
                        <span className="pwc-brief15-task-meta">
                          <em>{task.sourceLabel}</em>
                          <strong>{taskTiming(task, briefClock)}</strong>
                        </span>
                        <h3>{task.title}</h3>
                        <p>{task.clientName} · {task.ownerName || 'Unassigned'}</p>
                      </div>
                      <button type="button" onClick={() => navigate(task.actionUrl || '/admin/attention')}>
                        Open
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pwc-brief15-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No active attention items.</h3>
                  <p>The client-care queue is currently clear.</p>
                </div>
              )}
            </section>

            <section className="pwc-brief15-panel pwc-brief15-sessions" aria-labelledby="brief-sessions-title">
              <div className="pwc-brief15-panel-heading">
                <div>
                  <p className="admin-eyebrow">Coming up</p>
                  <h2 id="brief-sessions-title">Next seven days</h2>
                </div>
                <button type="button" onClick={() => navigate('/admin/scheduler')}>Calendar</button>
              </div>

              {!canSeeSessions ? (
                <div className="pwc-brief15-empty is-compact">
                  <span aria-hidden="true">—</span>
                  <h3>Session details are private.</h3>
                  <p>Your role does not include Session access.</p>
                </div>
              ) : upcomingSessions.length ? (
                <div className="pwc-brief15-session-list">
                  {upcomingSessions.map((booking) => (
                    <button
                      type="button"
                      key={booking.id}
                      onClick={() => navigate(booking.clientProfileId
                        ? `/admin/client-360/${booking.clientProfileId}`
                        : '/admin/scheduler')}
                    >
                      <time dateTime={booking.startsAt}>{formatTime(booking.startsAt)}</time>
                      <span>
                        <strong>{booking.guestName}</strong>
                        <small>{booking.title} · {formatDateTime(booking.startsAt)}</small>
                      </span>
                      <em>{booking.status}</em>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pwc-brief15-empty is-compact">
                  <span aria-hidden="true">○</span>
                  <h3>No sessions in the next seven days.</h3>
                  <p>Your visible calendar has open space.</p>
                </div>
              )}
            </section>

            <section className="pwc-brief15-panel pwc-brief15-activity" aria-labelledby="brief-activity-title">
              <div className="pwc-brief15-panel-heading">
                <div>
                  <p className="admin-eyebrow">Recent movement</p>
                  <h2 id="brief-activity-title">Unread Studio activity</h2>
                </div>
                <button type="button" onClick={() => navigate('/admin/activity')}>Activity center</button>
              </div>

              {priorityActivity.length ? (
                <div className="pwc-brief15-activity-list" aria-live="polite">
                  {priorityActivity.map((notification) => (
                    <button type="button" key={notification.id} onClick={() => openNotification(notification)}>
                      <span className={`is-${notification.importance || 'normal'}`} aria-hidden="true">
                        {notificationMark(notification.category)}
                      </span>
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.body || 'Open this update for context.'}</small>
                      </span>
                      <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pwc-brief15-empty is-compact">
                  <span aria-hidden="true">✓</span>
                  <h3>You are caught up.</h3>
                  <p>No unread Studio activity is waiting.</p>
                </div>
              )}
            </section>

            <section className="pwc-brief15-panel pwc-brief15-start" aria-labelledby="brief-start-title">
              <div className="pwc-brief15-panel-heading">
                <div>
                  <p className="admin-eyebrow">Start here</p>
                  <h2 id="brief-start-title">Move directly into the work</h2>
                </div>
              </div>
              <div className="pwc-brief15-shortcuts">
                <button type="button" onClick={() => navigate('/admin/clients')}>
                  <span>C</span><strong>Client Circle</strong><small>Open client care records</small>
                </button>
                <button type="button" onClick={() => navigate('/admin/inbox')}>
                  <span>M</span><strong>Secure Inbox</strong><small>Continue conversations</small>
                </button>
                <button type="button" onClick={() => navigate('/admin/scheduler')}>
                  <span>S</span><strong>Sessions</strong><small>Review the calendar</small>
                </button>
                <button type="button" onClick={() => navigate('/admin/leads')}>
                  <span>L</span><strong>Leads & Intake</strong><small>Move inquiries forward</small>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
