import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getAdminSessionReadiness } from '../../lib/nativeApi.js'

const bandOrder = { decision: 0, review: 1, almost: 2, ready: 3 }

function readCachedUser() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function roleLabel(role) {
  return ({ developer: 'Developer', owner: 'Owner', admin: 'Admin', staff: 'Studio Team' })[role] || 'Private account'
}

function readinessLabel(value) {
  return ({ decision: 'Decision needed', review: 'Needs review', almost: 'Almost ready', ready: 'Ready' })[value] || 'Preparation review'
}

function statusLabel(value) {
  return ({ requested: 'Requested', approved: 'Approved', confirmed: 'Confirmed' })[value] || 'Session'
}

function onboardingLabel(value, required) {
  if (!required) return 'Not required'
  return ({
    not_started: 'Not started',
    in_progress: 'In progress',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
    completed: 'Completed',
    paused: 'Paused',
  })[value] || 'Not started'
}

function formatDateTime(value, timezone) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  }).format(date)
}

function cardTone(band) {
  if (['decision', 'review'].includes(band)) return 'attention'
  if (band === 'almost') return 'watch'
  return 'steady'
}

function AdminSessionReadiness() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [snapshot, setSnapshot] = useState({ summary: {}, sessions: [], viewer: {}, horizonDays: 14 })
  const [selectedId, setSelectedId] = useState('')
  const [days, setDays] = useState(14)
  const [query, setQuery] = useState('')
  const [band, setBand] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadReadiness = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getAdminSessionReadiness(days)
      setSnapshot(response)
      setSelectedId((current) => (
        response.sessions?.some((session) => session.id === current)
          ? current
          : response.sessions?.[0]?.id || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'Session readiness could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days])

  useEffect(() => {
    const timer = window.setTimeout(loadReadiness, 0)
    return () => window.clearTimeout(timer)
  }, [loadReadiness])

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (snapshot.sessions || [])
      .filter((session) => {
        if (band !== 'all' && session.readiness?.band !== band) return false
        if (status !== 'all' && session.status !== status) return false
        if (!normalizedQuery) return true
        return [
          session.clientName,
          session.clientEmail,
          session.appointmentTypeName,
          session.readiness?.primaryReason,
          session.primaryGoal,
          ...(session.assignedMembers || []).map((member) => member.displayName),
        ].join(' ').toLowerCase().includes(normalizedQuery)
      })
      .sort((left, right) => (
        (bandOrder[left.readiness?.band] ?? 9) - (bandOrder[right.readiness?.band] ?? 9)
        || new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      ))
  }, [band, query, snapshot.sessions, status])

  const selectedSession = useMemo(() => (
    filteredSessions.find((session) => session.id === selectedId)
      || filteredSessions[0]
      || null
  ), [filteredSessions, selectedId])

  function resetFilters() {
    setQuery('')
    setBand('all')
    setStatus('all')
  }

  function openClient(session) {
    if (session.clientProfileId) navigate(`/admin/client-360/${session.clientProfileId}`)
    else navigate('/admin/scheduler')
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page pwc-momentum18-page">
        <header className="pwc-week16-hero pwc-momentum18-hero">
          <div>
            <p className="admin-eyebrow">Session Readiness</p>
            <h1>Prepare each session before the client arrives.</h1>
            <p>
              Review booking decisions, intake responses, onboarding, client care,
              conversations, ownership, and communication readiness in one calm workspace.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Session readiness access">
            <span aria-hidden="true">✓</span>
            <div>
              <small>{roleLabel(adminUser?.role)} view</small>
              <strong>{snapshot.viewer?.teamWide ? 'Studio-wide session preparation' : 'My assigned-client sessions'}</strong>
              <p>This is a preparation signal for the Studio team, not a rating of the client.</p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-momentum18-toolbar" aria-label="Session readiness controls">
          <div>
            <small>Preparation horizon</small>
            <strong>Upcoming sessions and the work needed before they begin</strong>
          </div>
          <label>
            <span className="sr-only">Session horizon</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </label>
          <button type="button" disabled={refreshing} onClick={() => loadReadiness({ quiet: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh readiness'}
          </button>
        </section>

        {error && <div className="pwc-week16-message is-error" role="alert">{error}</div>}

        <section className="pwc-week16-metrics" aria-label="Session readiness summary">
          <article>
            <span>Upcoming sessions</span>
            <strong>{snapshot.summary?.total || 0}</strong>
            <p>Within the next {snapshot.horizonDays || days} days</p>
          </article>
          <article className={snapshot.summary?.decision ? 'is-danger' : ''}>
            <span>Decision needed</span>
            <strong>{snapshot.summary?.decision || 0}</strong>
            <p>Requests awaiting booking action</p>
          </article>
          <article className={snapshot.summary?.review ? 'is-warning' : ''}>
            <span>Needs review</span>
            <strong>{snapshot.summary?.review || 0}</strong>
            <p>Preparation concerns to resolve</p>
          </article>
          <article>
            <span>Ready</span>
            <strong>{snapshot.summary?.ready || 0}</strong>
            <p>{snapshot.summary?.intakeIncomplete || 0} with incomplete intake</p>
          </article>
        </section>

        <section className="pwc-week16-filters" aria-label="Session readiness filters">
          <label className="pwc-week16-search">
            <span>Search sessions</span>
            <input
              type="search"
              value={query}
              placeholder="Client, session, owner, or preparation signal"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Readiness</span>
            <select value={band} onChange={(event) => setBand(event.target.value)}>
              <option value="all">All readiness</option>
              <option value="decision">Decision needed</option>
              <option value="review">Needs review</option>
              <option value="almost">Almost ready</option>
              <option value="ready">Ready</option>
            </select>
          </label>
          <label>
            <span>Booking status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All active statuses</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading session readiness">
            <span />
            <p>Preparing upcoming sessions…</p>
          </section>
        ) : (
          <div className="pwc-capacity17-grid pwc-momentum18-grid">
            <section aria-label="Session readiness board">
              <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
                {filteredSessions.map((session) => {
                  const tone = cardTone(session.readiness?.band)
                  const selected = session.id === selectedSession?.id
                  return (
                    <button
                      className={`pwc-capacity17-card pwc-momentum18-card is-${tone}${selected ? ' is-selected' : ''}`}
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                    >
                      <span className="pwc-capacity17-card-heading">
                        <span>
                          <small>{statusLabel(session.status)} · {session.appointmentTypeName}</small>
                          <strong>{session.clientName}</strong>
                          <em>{formatDateTime(session.startsAt, session.timezone)}</em>
                        </span>
                        <b>{session.readiness?.score ?? 0}</b>
                      </span>
                      <span className="pwc-capacity17-meter" aria-label={`${session.readiness?.score || 0} percent preparation signal`}>
                        <i style={{ width: `${session.readiness?.score || 0}%` }} />
                      </span>
                      <span className="pwc-capacity17-signal">
                        <strong>{readinessLabel(session.readiness?.band)}</strong>
                        <small>{session.readiness?.primaryReason}</small>
                      </span>
                      <span className="pwc-capacity17-stats">
                        <span><b>{session.readiness?.missingIntakeFields || 0}</b><small>Intake gaps</small></span>
                        <span><b>{session.overdueTasks || 0}</b><small>Overdue</small></span>
                        <span><b>{session.waitingOnTeam || 0}</b><small>Waiting</small></span>
                        <span><b>{session.assignedMembers?.length || 0}</b><small>Assigned</small></span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {!filteredSessions.length && (
                <div className="pwc-capacity17-empty pwc-momentum18-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No sessions match these filters</h3>
                  <p>Broaden the filters or move to a longer preparation horizon.</p>
                </div>
              )}
            </section>

            {selectedSession ? (
              <aside className="pwc-capacity17-detail pwc-momentum18-detail" aria-label={`${selectedSession.clientName} session preparation`}>
                <header>
                  <div>
                    <p className="admin-eyebrow">Selected session</p>
                    <h2>{selectedSession.clientName}</h2>
                    <small>{formatDateTime(selectedSession.startsAt, selectedSession.timezone)}</small>
                  </div>
                  <span className={`is-${cardTone(selectedSession.readiness?.band)}`}>
                    {readinessLabel(selectedSession.readiness?.band)}
                  </span>
                </header>

                <dl>
                  <div><dt>Status</dt><dd>{statusLabel(selectedSession.status)}</dd></div>
                  <div><dt>Session</dt><dd>{selectedSession.appointmentTypeName}</dd></div>
                  <div><dt>Intake</dt><dd>{selectedSession.answeredRequiredFields}/{selectedSession.requiredIntakeFields} required</dd></div>
                  <div><dt>Onboarding</dt><dd>{onboardingLabel(selectedSession.onboardingStatus, selectedSession.onboardingRequired)}</dd></div>
                  <div><dt>Portal</dt><dd>{selectedSession.portalActive ? 'Active' : 'Not active'}</dd></div>
                  <div><dt>Confirmation</dt><dd>{selectedSession.communications?.confirmationSentAt ? 'Sent' : 'Not recorded'}</dd></div>
                </dl>

                <section className="pwc-momentum18-focus">
                  <header><h3>Preparation ownership</h3><span>{selectedSession.assignedMembers?.length || 0}</span></header>
                  <strong>{selectedSession.primaryGoal || 'Session goal is not recorded'}</strong>
                  <p>{selectedSession.adminNotes || 'Add internal preparation notes in the Sessions workspace.'}</p>
                  <small>
                    {(selectedSession.assignedMembers || []).map((member) => member.displayName).join(', ')
                      || 'No Studio team member assigned'}
                  </small>
                </section>

                <section>
                  <header><h3>Preparation signals</h3><span>{selectedSession.readiness?.reasons?.length || 0}</span></header>
                  <div className="pwc-momentum18-reasons">
                    {(selectedSession.readiness?.reasons?.length
                      ? selectedSession.readiness.reasons
                      : ['Session preparation is current']
                    ).map((reason) => <p key={reason}>{reason}</p>)}
                  </div>
                </section>

                <section>
                  <header><h3>Care context</h3><span>{selectedSession.activeTasks || 0}</span></header>
                  <div className="pwc-capacity17-detail-list">
                    <div className="pwc-capacity17-session">
                      <span>Accountable care</span>
                      <strong>{selectedSession.activeTasks || 0} active actions</strong>
                      <small>{selectedSession.overdueTasks || 0} overdue · {selectedSession.urgentTasks || 0} urgent</small>
                    </div>
                    <div className="pwc-capacity17-session">
                      <span>Secure Inbox</span>
                      <strong>{selectedSession.waitingOnTeam || 0} waiting on the Studio</strong>
                      <small>{selectedSession.clientEmail || 'No client email recorded'}</small>
                    </div>
                  </div>
                </section>

                <div className="pwc-momentum18-actions">
                  <button type="button" onClick={() => openClient(selectedSession)}>
                    {selectedSession.clientProfileId ? 'Open Client 360' : 'Open booking request'}
                  </button>
                  <button type="button" onClick={() => navigate('/admin/scheduler')}>Open Sessions</button>
                  <button type="button" onClick={() => navigate('/admin/onboarding')}>Review onboarding</button>
                  <button type="button" onClick={() => navigate('/admin/attention')}>Open attention work</button>
                  <button type="button" onClick={() => navigate('/admin/inbox')}>Open Secure Inbox</button>
                </div>
              </aside>
            ) : (
              <aside className="pwc-capacity17-empty pwc-momentum18-empty">
                <span aria-hidden="true">○</span>
                <h3>Select a session</h3>
                <p>Choose a session card to review its preparation signal.</p>
              </aside>
            )}
          </div>
        )}
      </div>
    </AdminFrame>
  )
}

export default AdminSessionReadiness
