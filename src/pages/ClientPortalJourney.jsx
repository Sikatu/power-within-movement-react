import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import { getClientPortalDashboard, logoutClientPortal } from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalJourneyResources.css'

const businessTimeZone = 'America/New_York'

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
  if (!value) return 'No date recorded'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function readable(value) {
  const text = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Care Note'
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private care record. Please check the backend connection and try again.'
  return message || 'Your journey could not open yet.'
}

function JourneyEmpty({ title, children }) {
  return <div className="journey-empty"><strong>{title}</strong><p>{children}</p></div>
}

function ClientPortalJourney() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [portalNow] = useState(() => Date.now())

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  useEffect(() => {
    let active = true
    getClientPortalDashboard()
      .then((response) => {
        if (!active) return
        setDashboard(response)
        setLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        if (isAuthError(loadError)) {
          navigate('/client-portal/login', { replace: true })
          return
        }
        setError(friendlyError(loadError))
        setLoading(false)
      })
    return () => { active = false }
  }, [navigate])

  const serviceRecords = useMemo(() => dashboard?.serviceRecords || [], [dashboard])
  const visibleNotes = useMemo(() => dashboard?.visibleNotes || [], [dashboard])
  const followUps = useMemo(() => [...(dashboard?.followUps || [])]
    .sort((a, b) => new Date(a.follow_up_at || a.service_date || 0).getTime() - new Date(b.follow_up_at || b.service_date || 0).getTime()), [dashboard])
  const upcomingBookings = useMemo(() => (dashboard?.bookings || [])
    .filter((booking) => {
      const start = new Date(booking.starts_at).getTime()
      return Number.isFinite(start) && start >= portalNow && !['cancelled', 'completed', 'no_show'].includes(String(booking.status || '').toLowerCase())
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [dashboard, portalNow])

  const client = dashboard?.client
  const nextFollowUp = followUps[0]
  const nextBooking = upcomingBookings[0]
  const firstName = client?.firstName || client?.name?.split(' ')[0] || 'you'

  const journeyStats = [
    { label: 'Shared Reflections', value: visibleNotes.length, detail: 'Notes prepared for you' },
    { label: 'Next Steps', value: followUps.length, detail: 'Active care reminders' },
    { label: 'Care Milestones', value: serviceRecords.length, detail: 'Services in your record' },
  ]

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  return (
    <main id="main-content" className="portal-workspace portal-journey-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro journey-page-intro">
          <p className="eyebrow">My Journey</p>
          <h1>Your care, clearly gathered.</h1>
          <p>Start with your latest reflection and next step. Open your full history only when you need it.</p>
        </header>

        {error && <div className="portal-notice is-error" role="alert">{error}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Preparing your journey…</div>
        ) : (
          <>
            <section className="journey-overview" aria-label="Journey overview">
              <div className="journey-overview-copy">
                <p>Where You Are Now</p>
                <h2>{client?.clientVisibleNotes ? `A note for ${firstName}.` : 'Your care story is unfolding here.'}</h2>
                <span>{client?.clientVisibleNotes || 'As reflections, services, and next steps are prepared for you, this private record will grow alongside your journey.'}</span>
              </div>
            </section>

            <div className="journey-primary-grid">
              <section className="journey-reflections">
                <header className="journey-section-heading"><div><p className="eyebrow">Shared Reflections</p><h2>Notes From Your Care</h2></div><span>{visibleNotes.length} shared</span></header>
                {visibleNotes.length === 0 ? (
                  <JourneyEmpty title="No shared reflections yet.">Notes meant for you will appear here after they are prepared.</JourneyEmpty>
                ) : (
                  <div className="journey-note-list">
                    {visibleNotes.map((record, index) => (
                      <article key={record.id}>
                        <div className="journey-note-index">{String(index + 1).padStart(2, '0')}</div>
                        <div><span>{readable(record.service_type)}</span><h3>{record.title || record.service_name || 'Shared Reflection'}</h3><p>{record.client_visible_notes}</p><time>{formatDate(record.service_date || record.created_at)}</time></div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="journey-next-steps">
                <article className="journey-next-card">
                  <p className="eyebrow">Your Next Step</p>
                  {nextFollowUp ? (
                    <><h2>{nextFollowUp.title || nextFollowUp.service_name || 'A thoughtful follow-up'}</h2><time>{formatDateTime(nextFollowUp.follow_up_at || nextFollowUp.service_date)} ET</time>{nextFollowUp.summary && <p>{nextFollowUp.summary}</p>}</>
                  ) : (
                    <><h2>You are up to date.</h2><p>Any gentle reminders or next steps will appear here when they are ready.</p></>
                  )}
                </article>

                <article className="journey-session-card">
                  <p className="eyebrow">Next Session</p>
                  {nextBooking ? (
                    <><h3>{nextBooking.appointment_type_name || 'Private Session'}</h3><time>{formatDateTime(nextBooking.starts_at)} ET</time><Link to="/client-portal/sessions">Manage Session</Link></>
                  ) : (
                    <><h3>No session is currently scheduled.</h3><p>Choose a time when you are ready for the next conversation.</p><Link to="/client-portal/sessions">Book a Session</Link></>
                  )}
                </article>

                {followUps.length > 1 && (
                  <article className="journey-followup-list">
                    <p className="eyebrow">Coming After</p>
                    {followUps.slice(1, 4).map((record) => <div key={record.id}><strong>{record.title || record.service_name || 'Follow-up'}</strong><time>{formatDate(record.follow_up_at || record.service_date)}</time></div>)}
                  </article>
                )}
              </aside>
            </div>

            <details className="portal-progressive-section journey-history-disclosure">
              <summary>
                <span><strong>Care history</strong><small>Totals and your complete service record</small></span>
                <em>View details</em>
              </summary>
              <div className="journey-history-content">
                <div className="journey-stats" aria-label="Journey totals">
                  {journeyStats.map((stat) => <article key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><p>{stat.detail}</p></article>)}
                </div>
                <section className="journey-timeline-section">
                  <header className="journey-section-heading"><div><p className="eyebrow">Care History</p><h2>Your Service Record</h2></div><span>{serviceRecords.length} milestones</span></header>
                  {serviceRecords.length === 0 ? (
                    <JourneyEmpty title="Your care history will begin here.">Completed and planned services will appear as your client record grows.</JourneyEmpty>
                  ) : (
                    <div className="journey-timeline">
                      {serviceRecords.map((record) => (
                        <article key={record.id}>
                          <div className="journey-timeline-date"><time>{formatDate(record.service_date || record.created_at)}</time><span>{readable(record.status)}</span></div>
                          <div className="journey-timeline-marker"><span /></div>
                          <div className="journey-timeline-content"><span>{readable(record.service_type)}</span><h3>{record.title || record.service_name || 'Care Milestone'}</h3>{record.summary && <p>{record.summary}</p>}</div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </details>

            <p className="portal-private-footnote">Your journey record is private to you and the Power Within care team.</p>
          </>
        )}
      </div>
    </main>
  )
}

export default ClientPortalJourney
