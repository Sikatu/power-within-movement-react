import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAdminFounderAvailabilityException,
  getAdminFoundersViewOverview,
  updateAdminFounderAvailabilityException,
} from '../../lib/nativeApi'

function formatDate(value) {
  if (!value) return 'Not recorded'

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Not recorded'
  }
}

function formatLongDate(value) {
  if (!value) return 'Not recorded'

  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Not recorded'
  }
}

function formatTime(value) {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function getClientName(item) {
  return (
    [item?.first_name, item?.last_name].filter(Boolean).join(' ') ||
    item?.guest_name ||
    item?.client_email ||
    item?.guest_email ||
    'Client'
  )
}

function getInitials(name) {
  return String(name || 'Client')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'PW'
}

function getLocalDateOffset(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildDayBlockPayload(dateValue, notes = '') {
  const start = new Date(`${dateValue}T00:00:00`)
  const end = new Date(`${dateValue}T23:59:59`)

  return {
    title: 'Unavailable',
    exceptionType: 'day',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone: 'America/New_York',
    notes,
  }
}

function getNextSessionLabel(nextSession) {
  if (!nextSession) return 'No session waiting right now.'

  return `${formatTime(nextSession.starts_at)}  ${getClientName(nextSession)}`
}

export default function AdminFoundersView() {
  const [overview, setOverview] = useState(null)
  const [blockDate, setBlockDate] = useState(getLocalDateOffset(0))
  const [blockNotes, setBlockNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocking, setIsBlocking] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const metrics = overview?.metrics || {}
  const todaySessions = useMemo(
    () => overview?.todaySessions || [],
    [overview?.todaySessions],
  )
  const upcomingBookings = useMemo(
    () => overview?.upcomingBookings || [],
    [overview?.upcomingBookings],
  )
  const pendingRequests = useMemo(
    () => overview?.pendingRequests || [],
    [overview?.pendingRequests],
  )
  const followUps = useMemo(
    () => overview?.followUps || [],
    [overview?.followUps],
  )
  const availabilityExceptions = useMemo(
    () => overview?.availabilityExceptions || [],
    [overview?.availabilityExceptions],
  )

  const nextSession = useMemo(
    () => todaySessions[0] || upcomingBookings[0] || null,
    [todaySessions, upcomingBookings],
  )

  const laterSession = useMemo(
    () => todaySessions[1] || upcomingBookings[1] || null,
    [todaySessions, upcomingBookings],
  )

  async function loadFoundersView() {
    setIsLoading(true)
    setError('')

    try {
      const response = await getAdminFoundersViewOverview()
      setOverview(response)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Founders View.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    document.body.classList.add('admin-app-mode')
    document.body.classList.add('founders-view-standalone-mode')

    const timer = window.setTimeout(() => {
      loadFoundersView()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.body.classList.remove('founders-view-standalone-mode')
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  async function handleBlockDay(dateValue, notes) {
    setIsBlocking(true)
    setNotice('')
    setError('')

    try {
      await createAdminFounderAvailabilityException(
        buildDayBlockPayload(dateValue, notes),
      )
      await loadFoundersView()
      setNotice('Unavailable day saved.')
    } catch (blockError) {
      setError(blockError.message || 'Unable to block this day.')
    } finally {
      setIsBlocking(false)
    }
  }

  async function handleArchiveAvailability(exceptionId) {
    setNotice('')
    setError('')

    try {
      await updateAdminFounderAvailabilityException(exceptionId, {
        status: 'archived',
      })
      await loadFoundersView()
      setNotice('Availability block removed.')
    } catch (archiveError) {
      setError(archiveError.message || 'Unable to remove this block.')
    }
  }

  return (
    <main className="founders-luxury-page-v1">
      <header className="founders-luxury-topbar-v1">
        <Link to="/admin/founders-view" className="founders-luxury-brand-v1">
          <span aria-hidden="true"></span>
          <strong>Power Within Collective</strong>
        </Link>

        <p>Good morning, Kim</p>

        <div className="founders-luxury-top-actions-v1">
          <Link to="/admin/dashboard">Open The Studio</Link>
          <Link to="/admin/scheduler">Schedule</Link>
        </div>
      </header>

      <section className="founders-luxury-shell-v1">
        <section className="founders-luxury-hero-v1">
          <div>
            <p className="founders-luxury-kicker-v1">Owner View</p>
            <h1>Founders View</h1>
            <div className="founders-luxury-divider-v1" aria-hidden="true">
              <span />
              <i></i>
              <span />
            </div>
            <p>
              A calm daily view of what needs your attention, what can wait,
              and where your presence matters most.
            </p>
          </div>

          <div className="founders-luxury-hero-art-v1" aria-hidden="true">
            <span />
          </div>
        </section>

        {notice && <div className="admin-notice is-success">{notice}</div>}
        {error && <div className="admin-notice is-error">{error}</div>}

        <section className="founders-luxury-metrics-v1">
          <article>
            <div className="founders-luxury-icon-v1 is-sun"></div>
            <div>
              <span>Today Sessions</span>
              <strong>{metrics.todaySessions || 0}</strong>
              <p>{nextSession ? `Next up at ${formatTime(nextSession.starts_at)}` : 'A spacious day'}</p>
            </div>
          </article>

          <article>
            <div className="founders-luxury-icon-v1 is-people"></div>
            <div>
              <span>Pending Requests</span>
              <strong>{metrics.pendingRequests || 0}</strong>
              <p>{(metrics.pendingRequests || 0) === 1 ? 'Awaiting review' : 'Awaiting your review'}</p>
            </div>
          </article>

          <article>
            <div className="founders-luxury-icon-v1 is-heart"></div>
            <div>
              <span>Follow-Ups</span>
              <strong>{metrics.followUps || 0}</strong>
              <p>Clients to reconnect</p>
            </div>
          </article>

          <article>
            <div className="founders-luxury-icon-v1 is-message"></div>
            <div>
              <span>Messages</span>
              <strong>{metrics.unreadMessages || 0}</strong>
              <p>Coming soon</p>
            </div>
          </article>
        </section>

        <section className="founders-luxury-grid-v1">
          <article className="founders-luxury-card-v1 is-session">
            <p className="founders-luxury-kicker-v1">Today</p>
            <h2>{nextSession ? 'Your Next Session' : 'Your Day is Open'}</h2>

            {isLoading ? (
              <p className="founders-luxury-empty-v1">Gathering today view...</p>
            ) : nextSession ? (
              <>
                <div className="founders-luxury-client-v1">
                  <div className="founders-luxury-avatar-v1">
                    {getInitials(getClientName(nextSession))}
                  </div>

                  <div>
                    <strong>{getClientName(nextSession)}</strong>
                    <p>{nextSession.status || 'Scheduled session'}</p>
                    <small>{getNextSessionLabel(nextSession)}</small>
                  </div>
                </div>

                <div className="founders-luxury-session-meta-v1">
                  <span>{formatTime(nextSession.starts_at)}</span>
                  <span>{formatLongDate(nextSession.starts_at)}</span>
                </div>

                <Link to="/admin/scheduler">View Details</Link>
              </>
            ) : (
              <div className="founders-luxury-soft-note-v1">
                <strong>No sessions are scheduled for today.</strong>
                <p>Kim can rest, prepare, or make space for deeper client care.</p>
              </div>
            )}
          </article>

          <article className="founders-luxury-card-v1 is-availability">
            <p className="founders-luxury-kicker-v1">Block Time Away</p>
            <h2>Protect your time.</h2>
            <p>
              Block days when you are unavailable, so clients are cared for
              clearly.
            </p>

            <div className="founders-luxury-quick-actions-v1">
              <button
                type="button"
                onClick={() =>
                  handleBlockDay(
                    getLocalDateOffset(0),
                    'Blocked from The Founders View.',
                  )
                }
                disabled={isBlocking}
              >
                I am unavailable today
              </button>

              <button
                type="button"
                onClick={() =>
                  handleBlockDay(
                    getLocalDateOffset(1),
                    'Blocked from The Founders View.',
                  )
                }
                disabled={isBlocking}
              >
                Block tomorrow
              </button>
            </div>

            <label>
              <span>Pick a date</span>
              <input
                type="date"
                value={blockDate}
                onChange={(event) => setBlockDate(event.target.value)}
              />
            </label>

            <label>
              <span>Private note</span>
              <input
                value={blockNotes}
                onChange={(event) => setBlockNotes(event.target.value)}
                placeholder="Add a note, optional"
              />
            </label>

            <button
              type="button"
              onClick={() => handleBlockDay(blockDate, blockNotes)}
              disabled={isBlocking || !blockDate}
            >
              {isBlocking ? 'Saving...' : 'Save Unavailable Date'}
            </button>
          </article>

          <article className="founders-luxury-card-v1 is-care">
            <p className="founders-luxury-kicker-v1">Clients Needing Care</p>
            <h2>
              {pendingRequests.length === 0 && followUps.length === 0
                ? 'You are all set'
                : 'A gentle nudge'}
            </h2>

            {pendingRequests.length === 0 && followUps.length === 0 ? (
              <p>No urgent follow-ups need your attention right now.</p>
            ) : (
              <div className="founders-luxury-mini-list-v1">
                {pendingRequests.slice(0, 2).map((request) => (
                  <div key={request.id}>
                    <strong>{getClientName(request)}</strong>
                    <span>New booking request</span>
                  </div>
                ))}

                {followUps.slice(0, 2).map((followUp) => (
                  <div key={followUp.id}>
                    <strong>{getClientName(followUp)}</strong>
                    <span>{followUp.title || 'Follow-up due'}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="founders-luxury-card-v1 is-blocks">
            <p className="founders-luxury-kicker-v1">Active Blocks</p>
            <h2>Your unavailable dates</h2>

            {availabilityExceptions.length === 0 ? (
              <p>No unavailable dates have been added yet.</p>
            ) : (
              <div className="founders-luxury-block-list-v1">
                {availabilityExceptions.slice(0, 4).map((block) => (
                  <div key={block.id}>
                    <span>{formatDate(block.starts_at)}</span>
                    <button
                      type="button"
                      onClick={() => handleArchiveAvailability(block.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {laterSession && (
          <section className="founders-luxury-next-v1">
            <p>Later today</p>
            <strong>
              {formatTime(laterSession.starts_at)}  {getClientName(laterSession)}
            </strong>
            <Link to="/admin/scheduler">Open Calendar</Link>
          </section>
        )}
      </section>
    </main>
  )
}
