import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminAdvancedFilterToggle from '../../components/admin/AdminAdvancedFilterToggle.jsx'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import {
  getAdminAttentionQueue,
  getAdminBookings,
  getMyTeamAccess,
  updateAdminAttentionItem,
} from '../../lib/nativeApi.js'

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function parseLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

function startOfDay(value) {
  const date = parseLocalDate(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek(value) {
  const date = startOfDay(value)
  const day = date.getDay()
  const distance = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + distance)
  return date
}

function addDays(value, amount) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function dateKey(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = parseLocalDate(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatWeekRange(start) {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()

  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(start)

  const endLabel = new Intl.DateTimeFormat(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(end)

  return `${startLabel} – ${endLabel}`
}

function formatDayLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(value)
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

function taskKey(task) {
  return `${task.sourceType}:${task.id}`
}

function roleLabel(role) {
  return {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }[role] || 'Private account'
}

function priorityLabel(priority) {
  return {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  }[priority] || 'Normal'
}

function taskIsOverdue(task, today) {
  if (!task.dueAt) return false
  const due = startOfDay(task.dueAt).getTime()
  return Number.isFinite(due) && due < today.getTime()
}

export default function AdminWeekPlanner() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [teamAccess, setTeamAccess] = useState(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [tasks, setTasks] = useState([])
  const [bookings, setBookings] = useState([])
  const [teamUsers, setTeamUsers] = useState([])
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('all')
  const [kind, setKind] = useState('all')
  const [priority, setPriority] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const role = adminUser?.role || 'staff'
  const isStaff = role === 'staff'
  const canManageTasks = !isStaff || teamAccess?.permissions?.clients === 'manage'
  const canSeeSessions = !isStaff || (teamAccess?.permissions?.sessions || 'none') !== 'none'

  const applyQueueResponse = useCallback((response) => {
    setTasks(response.tasks || [])
    setTeamUsers(response.teamUsers || [])
  }, [])

  const loadWeek = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')
    setNotice('')

    const results = await Promise.allSettled([
      getAdminAttentionQueue(),
      getAdminBookings(),
      isStaff ? getMyTeamAccess() : Promise.resolve(null),
    ])

    const [queueResult, bookingResult, accessResult] = results
    const failures = []

    if (queueResult.status === 'fulfilled') {
      applyQueueResponse(queueResult.value)
    } else {
      failures.push('attention items')
    }

    if (bookingResult.status === 'fulfilled') {
      setBookings((bookingResult.value.bookings || []).map(normalizeBooking))
    } else {
      failures.push('sessions')
    }

    if (accessResult.status === 'fulfilled') {
      setTeamAccess(accessResult.value?.access || null)
    }

    if (failures.length === 2) {
      setError('The Studio Week Planner could not be loaded. Please refresh and try again.')
    } else if (failures.length) {
      setNotice(`The planner loaded with limited ${failures.join(' and ')} information.`)
    }

    setLoading(false)
    setRefreshing(false)
  }, [applyQueueResponse, isStaff])

  useEffect(() => {
    const timer = window.setTimeout(loadWeek, 0)
    return () => window.clearTimeout(timer)
  }, [loadWeek])

  const days = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  ), [weekStart])

  const today = useMemo(() => startOfDay(new Date()), [])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tasks.filter((task) => {
      if (kind === 'sessions') return false
      if (priority !== 'all' && task.priority !== priority) return false
      if (owner === 'mine' && task.ownerUserId !== adminUser?.id) return false
      if (owner === 'unassigned' && task.ownerUserId) return false
      if (owner !== 'all' && !['mine', 'unassigned'].includes(owner) && task.ownerUserId !== owner) return false

      if (!normalizedQuery) return true

      return [
        task.title,
        task.description,
        task.clientName,
        task.clientEmail,
        task.ownerName,
        task.sourceLabel,
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [adminUser?.id, kind, owner, priority, query, tasks])

  const filteredBookings = useMemo(() => {
    if (!canSeeSessions || kind === 'tasks') return []
    const normalizedQuery = query.trim().toLowerCase()

    return bookings.filter((booking) => {
      const startsAt = new Date(booking.startsAt).getTime()
      if (!Number.isFinite(startsAt)) return false
      if (startsAt < weekStart.getTime() || startsAt >= weekEnd.getTime()) return false
      if (['cancelled', 'declined', 'completed'].includes(booking.status)) return false

      if (!normalizedQuery) return true
      return `${booking.title} ${booking.guestName} ${booking.status}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [bookings, canSeeSessions, kind, query, weekEnd, weekStart])

  const weekTasks = useMemo(() => filteredTasks.filter((task) => {
    const key = dateKey(task.dueAt)
    return key >= dateKey(weekStart) && key < dateKey(weekEnd)
  }), [filteredTasks, weekEnd, weekStart])

  const needsScheduling = useMemo(() => filteredTasks.filter((task) => (
    !task.dueAt || taskIsOverdue(task, today)
  )), [filteredTasks, today])

  const metrics = useMemo(() => ({
    sessions: filteredBookings.length,
    tasks: weekTasks.length,
    overdue: filteredTasks.filter((task) => taskIsOverdue(task, today)).length,
    unscheduled: filteredTasks.filter((task) => !task.dueAt).length,
  }), [filteredBookings.length, filteredTasks, today, weekTasks.length])

  const ownerOptions = useMemo(() => (
    teamUsers.filter((user) => user.status !== 'disabled')
  ), [teamUsers])

  function resetFilters() {
    setQuery('')
    setOwner('all')
    setKind('all')
    setPriority('all')
  }

  function openTaskContext(task) {
    if (task.sourceType === 'lead_follow_up') {
      navigate('/admin/leads')
      return
    }

    if (task.clientProfileId) {
      navigate(`/admin/client-360/${task.clientProfileId}`)
      return
    }

    navigate('/admin/attention')
  }

  function openSession(booking) {
    if (booking.clientProfileId) {
      navigate(`/admin/client-360/${booking.clientProfileId}`)
      return
    }

    navigate('/admin/scheduler')
  }

  async function updateTask(task, payload, successMessage) {
    if (!canManageTasks || savingKey) return

    const key = taskKey(task)
    setSavingKey(key)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminAttentionItem(
        task.sourceType,
        task.clientProfileId,
        task.id,
        payload,
      )
      applyQueueResponse(response)
      setNotice(response.message || successMessage)
    } catch (saveError) {
      setError(saveError.message || 'The attention item could not be updated.')
    } finally {
      setSavingKey('')
    }
  }

  function moveTask(task, nextDate) {
    return updateTask(
      task,
      { dueAt: nextDate || null },
      nextDate ? 'Attention item moved to the selected day.' : 'Attention item moved to the unscheduled queue.',
    )
  }

  function completeTask(task) {
    return updateTask(task, { status: 'completed' }, 'Attention item completed.')
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page">
        <header className="pwc-week16-hero">
          <div>
            <p className="admin-eyebrow">Studio Week Planner</p>
            <h1>Balance the week before the week starts balancing you.</h1>
            <p>
              See sessions and accountable follow-ups together, then move client
              care work to the day it can realistically be completed.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Planner access">
            <span aria-hidden="true">7</span>
            <div>
              <small>{roleLabel(role)} view</small>
              <strong>{canManageTasks ? 'Planning controls active' : 'View-only planning'}</strong>
              <p>
                {isStaff
                  ? 'Your assigned clients and permitted Studio modules are respected.'
                  : 'Account-visible sessions and care actions are included.'}
              </p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar" aria-label="Week controls">
          <div className="pwc-week16-week-switcher">
            <button type="button" aria-label="Previous week" onClick={() => setWeekStart((current) => addDays(current, -7))}>
              ←
            </button>
            <div>
              <small>Planning week</small>
              <strong>{formatWeekRange(weekStart)}</strong>
            </div>
            <button type="button" aria-label="Next week" onClick={() => setWeekStart((current) => addDays(current, 7))}>
              →
            </button>
            <button className="is-today" type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              This week
            </button>
          </div>

          <button
            className="pwc-week16-refresh"
            type="button"
            disabled={refreshing}
            onClick={() => loadWeek({ quiet: true })}
          >
            {refreshing ? 'Refreshing…' : 'Refresh planner'}
          </button>
        </section>

        {(error || notice) && (
          <div
            className={`pwc-week16-message${error ? ' is-error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <section className="pwc-week16-metrics" aria-label="Weekly workload summary">
          <article>
            <span>Sessions</span>
            <strong>{metrics.sessions}</strong>
            <p>Scheduled this week</p>
          </article>
          <article>
            <span>Attention items</span>
            <strong>{metrics.tasks}</strong>
            <p>Due inside this week</p>
          </article>
          <article className={metrics.overdue ? 'is-danger' : ''}>
            <span>Overdue</span>
            <strong>{metrics.overdue}</strong>
            <p>Needs a new decision</p>
          </article>
          <article className={metrics.unscheduled ? 'is-warning' : ''}>
            <span>Unscheduled</span>
            <strong>{metrics.unscheduled}</strong>
            <p>Has no due date</p>
          </article>
        </section>

        <section className={`pwc-week16-filters pwc-ops36-filters${filtersOpen ? ' is-open' : ''}`} aria-label="Planner filters">
          <label className="pwc-week16-search">
            <span>Search</span>
            <input
              type="search"
              value={query}
              placeholder="Client, session, task, or owner"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <AdminAdvancedFilterToggle
            open={filtersOpen}
            activeCount={[kind !== 'all', owner !== 'all', priority !== 'all'].filter(Boolean).length}
            onToggle={() => setFiltersOpen((current) => !current)}
          />

          <label>
            <span>Show</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">Sessions and tasks</option>
              <option value="tasks">Tasks only</option>
              <option value="sessions">Sessions only</option>
            </select>
          </label>

          <label>
            <span>Owner</span>
            <select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="all">Everyone</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {ownerOptions.map((user) => (
                <option key={user.id} value={user.id}>{user.displayName || user.email}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </label>

          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading week planner">
            {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
          </section>
        ) : (
          <div className="pwc-week16-layout">
            <section className="pwc-week16-board" aria-label="Seven-day Studio plan" aria-live="polite">
              {days.map((day) => {
                const key = dateKey(day)
                const dayTasks = weekTasks.filter((task) => dateKey(task.dueAt) === key)
                const daySessions = filteredBookings.filter((booking) => dateKey(booking.startsAt) === key)
                const isToday = key === dateKey(today)

                return (
                  <article className={`pwc-week16-day${isToday ? ' is-today' : ''}`} key={key}>
                    <header>
                      <div>
                        <small>{isToday ? 'Today' : 'Studio day'}</small>
                        <h2>{formatDayLabel(day)}</h2>
                      </div>
                      <span>{dayTasks.length + daySessions.length}</span>
                    </header>

                    <div className="pwc-week16-day-content">
                      {daySessions.map((booking) => (
                        <button
                          className="pwc-week16-session"
                          type="button"
                          key={`session-${booking.id}`}
                          onClick={() => openSession(booking)}
                        >
                          <span>{formatTime(booking.startsAt)}</span>
                          <strong>{booking.guestName}</strong>
                          <small>{booking.title}</small>
                        </button>
                      ))}

                      {dayTasks.map((task) => (
                        <article className={`pwc-week16-task is-${task.priority || 'normal'}`} key={taskKey(task)}>
                          <div className="pwc-week16-task-heading">
                            <span>{priorityLabel(task.priority)}</span>
                            <small>{task.sourceLabel}</small>
                          </div>
                          <strong>{task.title}</strong>
                          <p>{task.clientName || 'Studio follow-up'}</p>
                          <small>{task.ownerName || 'Unassigned'}</small>

                          <div className="pwc-week16-task-actions">
                            <button type="button" onClick={() => openTaskContext(task)}>Open</button>
                            {canManageTasks && (
                              <>
                                <label>
                                  <span className="sr-only">Move {task.title}</span>
                                  <select
                                    value={key}
                                    disabled={savingKey === taskKey(task)}
                                    onChange={(event) => moveTask(task, event.target.value)}
                                  >
                                    {days.map((optionDay) => (
                                      <option key={dateKey(optionDay)} value={dateKey(optionDay)}>
                                        {formatDayLabel(optionDay)}
                                      </option>
                                    ))}
                                    <option value="">No due date</option>
                                  </select>
                                </label>
                                <button
                                  className="is-complete"
                                  type="button"
                                  disabled={savingKey === taskKey(task)}
                                  onClick={() => completeTask(task)}
                                >
                                  {savingKey === taskKey(task) ? 'Saving…' : 'Complete'}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}

                      {!dayTasks.length && !daySessions.length && (
                        <div className="pwc-week16-empty-day">
                          <span aria-hidden="true">○</span>
                          <p>No scheduled work</p>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>

            <aside className="pwc-week16-backlog" aria-label="Needs scheduling">
              <header>
                <div>
                  <p className="admin-eyebrow">Needs scheduling</p>
                  <h2>Make a clear decision.</h2>
                </div>
                <span>{needsScheduling.length}</span>
              </header>

              <p className="pwc-week16-backlog-intro">
                Overdue and undated work stays visible until it receives a realistic place in the week.
              </p>

              <div className="pwc-week16-backlog-list">
                {needsScheduling.map((task) => (
                  <article className={`pwc-week16-backlog-item${taskIsOverdue(task, today) ? ' is-overdue' : ''}`} key={`backlog-${taskKey(task)}`}>
                    <div>
                      <small>{taskIsOverdue(task, today) ? 'Overdue' : 'No due date'}</small>
                      <strong>{task.title}</strong>
                      <p>{task.clientName || 'Studio follow-up'}</p>
                      <span>{task.ownerName || 'Unassigned'} · {priorityLabel(task.priority)}</span>
                    </div>

                    <div className="pwc-week16-backlog-actions">
                      <button type="button" onClick={() => openTaskContext(task)}>Open</button>
                      {canManageTasks && (
                        <label>
                          <span className="sr-only">Schedule {task.title}</span>
                          <select
                            value=""
                            disabled={savingKey === taskKey(task)}
                            onChange={(event) => moveTask(task, event.target.value)}
                          >
                            <option value="">Choose a day…</option>
                            {days.map((optionDay) => (
                              <option key={dateKey(optionDay)} value={dateKey(optionDay)}>
                                {formatDayLabel(optionDay)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </article>
                ))}

                {!needsScheduling.length && (
                  <div className="pwc-week16-backlog-empty">
                    <span aria-hidden="true">✓</span>
                    <strong>Nothing is waiting for a date.</strong>
                    <p>Overdue and unscheduled items will appear here.</p>
                  </div>
                )}
              </div>

              <button className="pwc-week16-open-queue" type="button" onClick={() => navigate('/admin/attention')}>
                Open full attention queue
              </button>
            </aside>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
