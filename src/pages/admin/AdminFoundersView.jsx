import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FounderDeveloperBanner from '../../components/admin/FounderDeveloperBanner'
import FounderLiveClocks from '../../components/admin/FounderLiveClocks.jsx'
import FounderVoiceRecorder from '../../components/admin/FounderVoiceRecorder.jsx'
import {
  getFounderCommandCenter,
  getAdminFoundersViewOverview,
  updateAdminFounderDateAvailability,
  logoutAdmin,
  updateAdminFounderAvailabilityException,
} from '../../lib/nativeApi'

import './AdminFreshUI.css'

const FOUNDER_TIME_ZONE = 'America/New_York'
const FOUNDER_VIEWS = [
  { id: 'today', label: 'Today', description: 'Schedule and decisions' },
  { id: 'protect', label: 'Protect my time', description: 'Quick availability changes' },
  { id: 'voice', label: 'Voice notes', description: 'Record and reuse ideas' },
  { id: 'clocks', label: 'World clocks', description: 'Time zone reference' },
]
const FOUNDER_VIEW_IDS = new Set(FOUNDER_VIEWS.map((view) => view.id))

function formatDate(value, options = {}, timeZone = FOUNDER_TIME_ZONE) {
  if (!value) return 'Not recorded'

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: options.includeYear === false ? undefined : 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Not recorded'
  }
}

function formatLongDate(value = new Date(), timeZone = FOUNDER_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Today'
  }
}

function formatTime(value, timeZone = FOUNDER_TIME_ZONE) {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

function getBusinessHour(value = new Date(), timeZone = FOUNDER_TIME_ZONE) {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(value)),
    )
  } catch {
    return new Date().getHours()
  }
}

function getGreeting(value = new Date(), timeZone = FOUNDER_TIME_ZONE) {
  const hour = getBusinessHour(value, timeZone)

  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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
  return (
    String(name || 'Client')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PW'
  )
}

function getBusinessDateOffset(offsetDays = 0, timeZone = FOUNDER_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day'].includes(part.type))
      .map((part) => [part.type, Number(part.value)]),
  )

  const date = new Date(Date.UTC(values.year, values.month - 1, values.day))
  date.setUTCDate(date.getUTCDate() + offsetDays)

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function getAttentionDate(item) {
  return item.follow_up_at || item.created_at || item.starts_at || null
}

export default function AdminFoundersView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [overview, setOverview] = useState(null)
  const [founderTools, setFounderTools] = useState(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [blockDate, setBlockDate] = useState('')
  const [blockNotes, setBlockNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocking, setIsBlocking] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const requestedView = searchParams.get('view') || 'today'
  const activeView = FOUNDER_VIEW_IDS.has(requestedView) ? requestedView : 'today'

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

  const scheduleItems = useMemo(() => {
    if (todaySessions.length > 0) {
      return todaySessions.slice(0, 4)
    }

    return upcomingBookings.slice(0, 3)
  }, [todaySessions, upcomingBookings])

  const attentionItems = useMemo(() => {
    const requests = pendingRequests.map((request) => ({
      ...request,
      attentionType: 'request',
      attentionLabel: 'Booking request waiting for review',
      actionLabel: 'Review request',
      actionPath: '/admin/scheduler',
    }))

    const care = followUps.map((followUp) => ({
      ...followUp,
      attentionType: 'care',
      attentionLabel: followUp.title || 'Client follow-up is due',
      actionLabel: 'Open care record',
      actionPath: followUp.client_profile_id
        ? `/admin/clients/${followUp.client_profile_id}/care`
        : '/admin/clients',
    }))

    return [...requests, ...care]
      .sort((left, right) => {
        if (left.attentionType !== right.attentionType) {
          return left.attentionType === 'request' ? -1 : 1
        }

        return new Date(getAttentionDate(left) || 0) - new Date(getAttentionDate(right) || 0)
      })
      .slice(0, 5)
  }, [followUps, pendingRequests])

  const dailyFocus = useMemo(() => {
    if (pendingRequests.length > 0) {
      const count = pendingRequests.length
      return `Review ${count} booking ${count === 1 ? 'request' : 'requests'} when you are ready.`
    }

    if (followUps.length > 0) {
      const count = followUps.length
      return `${count} client ${count === 1 ? 'follow-up needs' : 'follow-ups need'} a little care.`
    }

    if (todaySessions.length > 0) {
      const count = todaySessions.length
      return `Your focus today is ${count} meaningful ${count === 1 ? 'session' : 'sessions'}.`
    }

    return 'Nothing urgent is waiting. Your day has room to breathe.'
  }, [followUps.length, pendingRequests.length, todaySessions.length])

  const loadFoundersView = useCallback(async (filters = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const [response, toolsResponse] = await Promise.all([
        getAdminFoundersViewOverview(),
        getFounderCommandCenter(filters),
      ])
      setOverview(response)
      setFounderTools(toolsResponse)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Founder’s View.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('admin-app-mode')
    document.body.classList.add('founders-view-standalone-mode')

    const loadTimer = window.setTimeout(() => {
      loadFoundersView()
    }, 0)
    const clockTimer = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1_000)

    return () => {
      window.clearTimeout(loadTimer)
      window.clearInterval(clockTimer)
      document.body.classList.remove('founders-view-standalone-mode')
      document.body.classList.remove('admin-app-mode')
    }
  }, [loadFoundersView])

  async function handleBlockDay(dateValue, notes) {
    setIsBlocking(true)
    setNotice('')
    setError('')

    try {
      await updateAdminFounderDateAvailability(dateValue, {
        mode: 'unavailable',
        windows: [],
        notes,
      })
      await loadFoundersView()
      setBlockNotes('')
      setNotice(`${formatDate(`${dateValue}T12:00:00Z`, {}, schedulingTimezone)} is now protected.`)
    } catch (blockError) {
      setError(blockError.message || 'Unable to protect this date.')
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
      setNotice('The protected date has been reopened.')
    } catch (archiveError) {
      setError(archiveError.message || 'Unable to reopen this date.')
    }
  }

  async function handleLogout() {
    setIsSigningOut(true)
    setError('')

    try {
      await logoutAdmin()
      navigate('/admin/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message || 'Unable to sign out right now.')
      setIsSigningOut(false)
    }
  }

  const primaryTimezone = founderTools?.preferences?.primaryTimezone || 'America/Chicago'
  const schedulingTimezone = founderTools?.scheduling?.timezone || FOUNDER_TIME_ZONE
  const effectiveBlockDate = blockDate || getBusinessDateOffset(0, schedulingTimezone)

  function showFounderNotice(message) {
    setError('')
    setNotice(message || '')
  }

  function showFounderError(message) {
    setNotice('')
    setError(message || 'That Founder action could not be completed.')
  }

  function openFounderView(view) {
    setSearchParams(view === 'today' ? {} : { view })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="founder-home">
      <FounderDeveloperBanner />
      <header className="founder-home__topbar">
        <Link to="/admin/founders-view" className="founder-home__brand">
          <span aria-hidden="true" />
          <div>
            <strong>Power Within Collective</strong>
            <small>Founder’s View</small>
          </div>
        </Link>

        <div className="founder-home__top-actions">
          <Link to="/admin/founders-calendar" className="founder-home__calendar-link">
            Open calendar
          </Link>
          <Link to="/admin/founders-availability" className="founder-home__calendar-link">
            Availability
          </Link>
          <Link to="/admin/dashboard" className="founder-home__studio-link">
            Open The Studio
          </Link>
          <button
            type="button"
            className="founder-home__signout"
            onClick={handleLogout}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <div className="founder-home__shell">
        <section className="founder-home__intro">
          <div>
            <p className="founder-home__eyebrow">{formatLongDate(currentTime, primaryTimezone)}</p>
            <h1>{getGreeting(currentTime, primaryTimezone)}, Kim.</h1>
            <p className="founder-home__focus">{dailyFocus}</p>
          </div>

          <div className="founder-home__intro-side">
            <div className="founder-home__timezone" aria-label="Schedule timezone">
              <span aria-hidden="true" />
              <div>
                <small>Schedule shown in</small>
                <strong>{schedulingTimezone}</strong>
              </div>
            </div>

            <nav className="founder-home__primary-actions" aria-label="Founder controls">
              <Link to="/admin/founders-calendar">Open calendar</Link>
              <Link to="/admin/founders-availability">Availability</Link>
              <Link to="/admin/dashboard">Open The Studio</Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </nav>
          </div>
        </section>

        <div className="founder-home__feedback" aria-live="polite">
          {notice && <div className="admin-notice is-success">{notice}</div>}
          {error && <div className="admin-notice is-error">{error}</div>}
        </div>

        <nav className="founder-home__task-nav" aria-label="Founder workspace" role="tablist">
          {FOUNDER_VIEWS.map((view) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === view.id}
              className={activeView === view.id ? 'is-active' : ''}
              onClick={() => openFounderView(view.id)}
              key={view.id}
            >
              <strong>{view.label}</strong>
              <small>{view.description}</small>
            </button>
          ))}
        </nav>

        {activeView === 'clocks' && founderTools && <FounderLiveClocks
          currentTime={currentTime}
          preferences={founderTools.preferences}
          scheduling={founderTools.scheduling}
          onSaved={(preferences) => setFounderTools((current) => ({ ...current, preferences }))}
          onNotice={showFounderNotice}
          onError={showFounderError}
        />}

        {activeView === 'voice' && founderTools && <FounderVoiceRecorder
          workspace={founderTools}
          onRefresh={loadFoundersView}
          onNotice={showFounderNotice}
          onError={showFounderError}
        />}

        {['voice', 'clocks'].includes(activeView) && !founderTools && (
          <div className="founder-home__focus-loading">Opening your private Founder tools…</div>
        )}

        {activeView === 'today' && <section className="founder-home__pulse" aria-label="Today at a glance">
          <article>
            <span className="founder-home__pulse-icon is-calendar" aria-hidden="true" />
            <div>
              <small>Today</small>
              <strong>{metrics.todaySessions || 0}</strong>
              <p>{(metrics.todaySessions || 0) === 1 ? 'session' : 'sessions'}</p>
            </div>
          </article>

          <article>
            <span className="founder-home__pulse-icon is-decision" aria-hidden="true" />
            <div>
              <small>Decisions</small>
              <strong>{metrics.pendingRequests || 0}</strong>
              <p>booking {(metrics.pendingRequests || 0) === 1 ? 'request' : 'requests'}</p>
            </div>
          </article>

          <article>
            <span className="founder-home__pulse-icon is-care" aria-hidden="true" />
            <div>
              <small>Client care</small>
              <strong>{metrics.followUps || 0}</strong>
              <p>{(metrics.followUps || 0) === 1 ? 'follow-up' : 'follow-ups'}</p>
            </div>
          </article>
        </section>}

        {['today', 'protect'].includes(activeView) && <section className="founder-home__grid">
          <article className="founder-home__panel founder-home__panel--schedule" hidden={activeView !== 'today'}>
            <div className="founder-home__panel-heading">
              <div>
                <p className="founder-home__eyebrow">
                  {todaySessions.length > 0 ? 'Today’s rhythm' : 'Coming up'}
                </p>
                <h2>
                  {todaySessions.length > 0
                    ? 'Your schedule'
                    : 'Your next sessions'}
                </h2>
              </div>
              <Link to="/admin/founders-calendar">Open calendar</Link>
            </div>

            {isLoading ? (
              <div className="founder-home__empty">Gathering your schedule…</div>
            ) : scheduleItems.length === 0 ? (
              <div className="founder-home__empty founder-home__empty--warm">
                <strong>Your calendar is open.</strong>
                <p>There are no sessions waiting in the next two weeks.</p>
              </div>
            ) : (
              <div className="founder-home__schedule-list">
                {scheduleItems.map((session, index) => (
                  <div className="founder-home__session" key={session.id}>
                    <div className="founder-home__session-time">
                      <strong>{formatTime(session.starts_at, schedulingTimezone)}</strong>
                      <small>
                        {todaySessions.length > 0
                          ? schedulingTimezone
                          : formatDate(session.starts_at, { includeYear: false }, schedulingTimezone)}
                      </small>
                    </div>

                    <div className="founder-home__avatar" aria-hidden="true">
                      {getInitials(getClientName(session))}
                    </div>

                    <div className="founder-home__session-copy">
                      <strong>{getClientName(session)}</strong>
                      <span>{session.status || 'Scheduled session'}</span>
                    </div>

                    {index === 0 && <em>Next</em>}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="founder-home__panel founder-home__panel--attention" hidden={activeView !== 'today'}>
            <div className="founder-home__panel-heading">
              <div>
                <p className="founder-home__eyebrow">Needs your attention</p>
                <h2>What matters now</h2>
              </div>
            </div>

            {isLoading ? (
              <div className="founder-home__empty">Gathering priorities…</div>
            ) : attentionItems.length === 0 ? (
              <div className="founder-home__empty founder-home__empty--warm">
                <strong>You are all caught up.</strong>
                <p>No decisions or client follow-ups need you right now.</p>
              </div>
            ) : (
              <div className="founder-home__attention-list">
                {attentionItems.map((item) => (
                  <div className="founder-home__attention-item" key={`${item.attentionType}-${item.id}`}>
                    <span
                      className={`founder-home__attention-mark is-${item.attentionType}`}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{getClientName(item)}</strong>
                      <p>{item.attentionLabel}</p>
                      {getAttentionDate(item) && (
                        <small>{formatDate(getAttentionDate(item))}</small>
                      )}
                    </div>
                    <Link to={item.actionPath}>{item.actionLabel}</Link>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="founder-home__panel founder-home__panel--protect" hidden={activeView !== 'protect'}>
            <div className="founder-home__panel-heading">
              <div>
                <p className="founder-home__eyebrow">Shape your availability</p>
                <h2>Make space without closing the whole day.</h2>
              </div>
            </div>

            <p className="founder-home__panel-intro">
              Protect a full day quickly, or customize exactly when you are open.
            </p>

            <Link
              to={`/admin/founders-availability?date=${effectiveBlockDate}`}
              className="founder-home__availability-link"
            >
              Customize weekly hours or this date
            </Link>

            <div className="founder-home__quick-blocks">
              <button
                type="button"
                onClick={() =>
                  handleBlockDay(
                    getBusinessDateOffset(0, schedulingTimezone),
                    'Protected from Founder’s View.',
                  )
                }
                disabled={isBlocking}
              >
                Protect today
              </button>
              <button
                type="button"
                onClick={() =>
                  handleBlockDay(
                    getBusinessDateOffset(1, schedulingTimezone),
                    'Protected from Founder’s View.',
                  )
                }
                disabled={isBlocking}
              >
                Protect tomorrow
              </button>
            </div>

            <div className="founder-home__block-form">
              <label>
                <span>Choose a date</span>
                <input
                  type="date"
                  value={effectiveBlockDate}
                  min={getBusinessDateOffset(0, schedulingTimezone)}
                  onChange={(event) => setBlockDate(event.target.value)}
                />
              </label>

              <label>
                <span>Private note <small>optional</small></span>
                <input
                  value={blockNotes}
                  onChange={(event) => setBlockNotes(event.target.value)}
                  placeholder="Personal day, travel, preparation…"
                />
              </label>

              <button
                type="button"
                className="founder-home__protect-button"
                onClick={() => handleBlockDay(effectiveBlockDate, blockNotes)}
                disabled={isBlocking || !effectiveBlockDate}
              >
                {isBlocking ? 'Protecting…' : 'Protect all day'}
              </button>
            </div>
          </article>

          <article className="founder-home__panel founder-home__panel--blocks" hidden={activeView !== 'protect'}>
            <div className="founder-home__panel-heading">
              <div>
                <p className="founder-home__eyebrow">Protected dates</p>
                <h2>Your breathing room</h2>
              </div>
              <span className="founder-home__count">
                {availabilityExceptions.length}
              </span>
            </div>

            {availabilityExceptions.length === 0 ? (
              <div className="founder-home__empty">
                No protected dates have been added yet.
              </div>
            ) : (
              <div className="founder-home__block-list">
                {availabilityExceptions.slice(0, 5).map((block) => (
                  <div key={block.id}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{formatDate(block.starts_at, {}, schedulingTimezone)}</strong>
                      <small>{block.notes || 'Unavailable'}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleArchiveAvailability(block.id)}
                    >
                      Reopen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>}
      </div>
    </main>
  )
}
