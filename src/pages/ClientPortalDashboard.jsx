import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/images/logo.webp'
import { getClientPortalDashboard, getClientPortalResources, logoutClientPortal } from '../lib/nativeApi.js'
import './ClientPortalDashboard.css'

const businessTimeZone = 'America/New_York'

const resourceLabels = {
  guide: 'Guides',
  worksheet: 'Worksheets',
  link: 'Links',
  video: 'Videos',
  reminder: 'Reminders',
  note: 'Notes',
}

const resourceDescriptions = {
  guide: 'Curated direction and supportive references.',
  worksheet: 'Reflective exercises and guided prompts.',
  link: 'Helpful links selected for your journey.',
  video: 'Watchable resources and visual guidance.',
  reminder: 'Gentle reminders and next-step cues.',
  note: 'Personal notes and care-based references.',
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function formatDate(value) {
  if (!value) return 'No date'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function formatLabel(value) {
  const label = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return label ? label.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not specified'
}

function getSafeResourceUrl(value) {
  if (!value) return ''

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function getFriendlyDashboardError(message) {
  const normalized = String(message || '').toLowerCase()

  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('load failed')) {
    return 'We could not reach your private portal for a moment. Please check the backend connection and try again.'
  }

  if (normalized.includes('login required') || normalized.includes('unauthorized') || normalized.includes('401')) {
    return 'Your private session has ended. Please sign in again to continue.'
  }

  return message || 'We could not load your private portal yet. Please try again shortly.'
}

function EmptyState({ title, children }) {
  return (
    <div className="client-dashboard-empty">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

function ClientPortalDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [resources, setResources] = useState([])
  const [status, setStatus] = useState({ state: 'loading', message: '' })
  const [portalNow] = useState(() => Date.now())

  useEffect(() => {
    document.body.classList.add('client-dashboard-mode')
    return () => document.body.classList.remove('client-dashboard-mode')
  }, [])

  useEffect(() => {
    let active = true

    Promise.all([
      getClientPortalDashboard(),
      getClientPortalResources().catch(() => ({ resources: [] })),
    ])
      .then(([dashboardResponse, resourcesResponse]) => {
        if (!active) return
        setDashboard(dashboardResponse)
        setResources(resourcesResponse.resources || [])
        setStatus({ state: 'ready', message: '' })
      })
      .catch((error) => {
        if (!active) return
        const normalized = String(error.message || '').toLowerCase()

        if (normalized.includes('login required') || normalized.includes('unauthorized') || normalized.includes('401')) {
          navigate('/client-portal/login', { replace: true })
          return
        }

        setStatus({ state: 'error', message: getFriendlyDashboardError(error.message) })
      })

    return () => {
      active = false
    }
  }, [navigate])

  const bookings = useMemo(() => dashboard?.bookings || [], [dashboard])
  const visibleNotes = useMemo(() => dashboard?.visibleNotes || [], [dashboard])
  const followUps = useMemo(() => dashboard?.followUps || [], [dashboard])
  const serviceRecords = useMemo(() => dashboard?.serviceRecords || [], [dashboard])

  const upcomingBookings = useMemo(() => bookings
    .filter((booking) => {
      const startsAt = new Date(booking.starts_at).getTime()
      const bookingStatus = String(booking.status || '').toLowerCase()
      return Number.isFinite(startsAt) && startsAt >= portalNow && !['cancelled', 'completed', 'no_show'].includes(bookingStatus)
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [bookings, portalNow])

  const previousBookings = useMemo(() => bookings
    .filter((booking) => {
      const startsAt = new Date(booking.starts_at).getTime()
      return Number.isFinite(startsAt) && startsAt < portalNow
    })
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()), [bookings, portalNow])

  const sortedFollowUps = useMemo(() => [...followUps]
    .sort((a, b) => new Date(a.follow_up_at || 0).getTime() - new Date(b.follow_up_at || 0).getTime()), [followUps])

  const resourceGroups = useMemo(() => resources.reduce((groups, resource) => {
    const type = resource.resource_type || 'note'
    if (!groups[type]) groups[type] = []
    groups[type].push(resource)
    return groups
  }, {}), [resources])

  const client = dashboard?.client
  const firstName = client?.firstName || client?.name?.split(' ')[0] || 'there'
  const featuredResource = resources[0]
  const nextBooking = upcomingBookings[0]
  const nextFollowUp = sortedFollowUps[0]

  const focus = nextBooking
    ? {
        title: 'Your next session is already on the calendar.',
        text: `${nextBooking.appointment_type_name || 'Private session'} is scheduled for ${formatDateTime(nextBooking.starts_at)} Eastern Time.`,
      }
    : featuredResource
      ? {
          title: 'Begin with your resource library.',
          text: featuredResource.description || 'Review the guide selected for you whenever you need a grounded reset.',
        }
      : visibleNotes[0]
        ? {
            title: 'A reflection has been shared with you.',
            text: 'Return to your latest care note whenever you want to reconnect with the direction you established together.',
          }
        : {
            title: 'Your private care space is ready.',
            text: 'Shared resources, notes, sessions, and follow-ups will appear here as your Power Within journey grows.',
          }

  const stats = [
    { label: 'Visible Notes', value: visibleNotes.length, detail: 'Shared from your care record.' },
    { label: 'Resources', value: resources.length, detail: 'Guides, links, and reminders.' },
    { label: 'Sessions', value: bookings.length, detail: 'Connected session history.' },
    { label: 'Follow-Ups', value: followUps.length, detail: 'Gentle next-step reminders.' },
  ]

  const handleLogout = async () => {
    setStatus((current) => ({ ...current, state: 'logging-out', message: '' }))

    try {
      await logoutClientPortal()
      navigate('/client-portal/login', { replace: true })
    } catch (error) {
      setStatus({ state: 'ready', message: getFriendlyDashboardError(error.message) })
    }
  }

  if (status.state === 'loading') {
    return (
      <main id="main-content" className="client-dashboard-state">
        <img src={logo} alt="" />
        <p className="eyebrow">Power Within Client Portal</p>
        <h1>Preparing your private care space.</h1>
        <p role="status">Loading your notes, resources, sessions, and next steps…</p>
      </main>
    )
  }

  if (status.state === 'error') {
    return (
      <main id="main-content" className="client-dashboard-state">
        <img src={logo} alt="" />
        <p className="eyebrow">Private Portal</p>
        <h1>We could not open your care space yet.</h1>
        <p role="alert">{status.message}</p>
        <div>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>Try Again</button>
          <Link className="button button-secondary" to="/client-portal/login">Return to Login</Link>
        </div>
      </main>
    )
  }

  return (
    <div className="client-dashboard-page">
      <header className="client-dashboard-header">
        <div>
          <Link to="/client-portal/home" className="client-dashboard-brand">
            <img src={logo} alt="" />
            <strong><span>Power Within</span> Client Portal</strong>
          </Link>
          <div className="client-dashboard-header-actions">
            <div>
              <span>Signed in as</span>
              <strong>{client?.name || client?.email || 'Client'}</strong>
            </div>
            <Link to="/">Website</Link>
            <button type="button" onClick={handleLogout} disabled={status.state === 'logging-out'}>
              {status.state === 'logging-out' ? 'Signing Out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="client-dashboard-main">
        {status.message && <div className="client-dashboard-alert" role="alert">{status.message}</div>}

        <header className="client-dashboard-welcome">
          <p className="eyebrow">Your Private Care Space</p>
          <h1>Welcome, {firstName}.</h1>
          <p>Your private care space for shared notes, resources, reminders, and session history.</p>
        </header>

        <section className="client-dashboard-overview">
          <article className="client-dashboard-focus">
            <p className="eyebrow">Today&apos;s Portal Focus</p>
            <h2>{focus.title}</h2>
            <p>{focus.text}</p>
          </article>
          <div className="client-dashboard-stats">
            {stats.map((stat) => (
              <article key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <p>{stat.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="client-dashboard-feature">
          <div>
            <p className="eyebrow">Featured Resource</p>
            <h2>{featuredResource?.title || 'Your private library is ready.'}</h2>
            <p>{featuredResource?.description || 'When Power Within assigns a guide, worksheet, link, video, reminder, or note, it will appear here.'}</p>
          </div>
          <div>
            <span>{formatLabel(featuredResource?.resource_type || 'Resource')}</span>
            {featuredResource && <time>{formatDate(featuredResource.created_at)}</time>}
            {getSafeResourceUrl(featuredResource?.resource_url) ? (
              <a href={getSafeResourceUrl(featuredResource.resource_url)} target="_blank" rel="noreferrer">Open Resource</a>
            ) : (
              <em>{featuredResource ? 'Saved as a private note' : 'Awaiting first resource'}</em>
            )}
          </div>
        </section>

        <section className="client-dashboard-library">
          <header>
            <p className="eyebrow">Resources</p>
            <h2>Your Library</h2>
          </header>
          {resources.length === 0 ? (
            <EmptyState title="Your library is waiting for its first resource.">Power Within will place assigned guides, worksheets, links, and notes here.</EmptyState>
          ) : (
            <div className="client-dashboard-resource-grid">
              {Object.entries(resourceGroups).slice(0, 3).map(([type, items]) => (
                <article key={type}>
                  <span>{items.length} saved</span>
                  <h3>{resourceLabels[type] || formatLabel(type)}</h3>
                  <p>{resourceDescriptions[type] || 'Resources selected for your care.'}</p>
                  <div>
                    {items.slice(0, 3).map((resource) => {
                      const safeUrl = getSafeResourceUrl(resource.resource_url)
                      return (
                        <section key={resource.id}>
                          <strong>{resource.title}</strong>
                          {resource.description && <p>{resource.description}</p>}
                          <div>
                            <time>{formatDate(resource.created_at)}</time>
                            {safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">Open</a> : <em>Private note</em>}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="client-dashboard-care-grid">
          <article className="client-dashboard-panel client-dashboard-notes">
            <header>
              <p className="eyebrow">Client Notes</p>
              <h2>Shared With You</h2>
            </header>
            {visibleNotes.length === 0 ? (
              <EmptyState title="No shared reflections yet.">Client-visible notes will appear here after Power Within prepares them.</EmptyState>
            ) : (
              <div>
                {visibleNotes.slice(0, 3).map((record) => (
                  <article key={record.id}>
                    <span>{formatLabel(record.service_type)}</span>
                    <h3>{record.title || record.service_name}</h3>
                    <p>{record.client_visible_notes}</p>
                    <time>{formatDateTime(record.service_date || record.created_at)}</time>
                  </article>
                ))}
              </div>
            )}
          </article>

          <div className="client-dashboard-side-stack">
            <article className="client-dashboard-panel">
              <header>
                <p className="eyebrow">Follow-Up</p>
                <h2>Next Steps</h2>
              </header>
              {nextFollowUp ? (
                <div className="client-dashboard-single-record">
                  <strong>{nextFollowUp.title || nextFollowUp.service_name}</strong>
                  <span>{formatDateTime(nextFollowUp.follow_up_at)}</span>
                  {nextFollowUp.summary && <p>{nextFollowUp.summary}</p>}
                </div>
              ) : (
                <EmptyState title="You are up to date.">No active follow-up reminders right now.</EmptyState>
              )}
            </article>

            <article className="client-dashboard-panel">
              <header>
                <p className="eyebrow">Sessions</p>
                <h2>History</h2>
              </header>
              {previousBookings.length === 0 ? (
                <EmptyState title="No previous sessions yet.">Your connected session history will appear here.</EmptyState>
              ) : (
                <div className="client-dashboard-session-list">
                  {previousBookings.slice(0, 3).map((booking) => (
                    <article key={booking.id}>
                      <strong>{booking.appointment_type_name || 'Private Session'}</strong>
                      <span>{formatDateTime(booking.starts_at)} · {formatLabel(booking.status)}</span>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="client-dashboard-panel client-dashboard-records">
          <header>
            <p className="eyebrow">Care Record</p>
            <h2>Recent Service History</h2>
          </header>
          {serviceRecords.length === 0 ? (
            <EmptyState title="Your care history will begin here.">Completed and planned services will appear as your client record grows.</EmptyState>
          ) : (
            <div>
              {serviceRecords.slice(0, 8).map((record) => (
                <article key={record.id}>
                  <span>{formatLabel(record.service_type)}</span>
                  <strong>{record.title || record.service_name}</strong>
                  <em>{formatLabel(record.status)}</em>
                  <time>{formatDateTime(record.service_date || record.created_at)}</time>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="client-dashboard-private-note">Private access · Power Within Movement, LLC</p>
      </main>
    </div>
  )
}

export default ClientPortalDashboard
