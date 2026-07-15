import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getAdminSessionFollowThrough } from '../../lib/nativeApi.js'

const bandOrder = {
  reconcile: 0,
  recovery: 1,
  overdue: 2,
  notes: 3,
  next: 4,
  complete: 5,
}

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

function bandLabel(value) {
  return ({
    reconcile: 'Status needs update',
    recovery: 'Recovery needed',
    overdue: 'Follow-up overdue',
    notes: 'Notes needed',
    next: 'Next step needed',
    complete: 'Continuity set',
  })[value] || 'Follow-through review'
}

function statusLabel(value) {
  return ({
    requested: 'Requested',
    approved: 'Approved',
    confirmed: 'Confirmed',
    completed: 'Completed',
    no_show: 'No-show',
  })[value] || 'Session'
}

function formatDateTime(value, timezone, fallback = 'Not recorded') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  }).format(date)
}

function formatDate(value, fallback = 'Not scheduled') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date)
}

function cardTone(band) {
  if (['reconcile', 'recovery', 'overdue'].includes(band)) return 'attention'
  if (['notes', 'next'].includes(band)) return 'watch'
  return 'steady'
}

function AdminSessionFollowThrough() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [snapshot, setSnapshot] = useState({ summary: {}, sessions: [], viewer: {}, horizonDays: 30 })
  const [selectedId, setSelectedId] = useState('')
  const [days, setDays] = useState(30)
  const [query, setQuery] = useState('')
  const [band, setBand] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadFollowThrough = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getAdminSessionFollowThrough(days)
      setSnapshot(response)
      setSelectedId((current) => (
        response.sessions?.some((session) => session.id === current)
          ? current
          : response.sessions?.[0]?.id || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'Session follow-through could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days])

  useEffect(() => {
    const timer = window.setTimeout(loadFollowThrough, 0)
    return () => window.clearTimeout(timer)
  }, [loadFollowThrough])

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (snapshot.sessions || [])
      .filter((session) => {
        if (band !== 'all' && session.followThrough?.band !== band) return false
        if (status !== 'all' && session.status !== status) return false
        if (!normalizedQuery) return true

        return [
          session.clientName,
          session.clientEmail,
          session.appointmentTypeName,
          session.followThrough?.primaryReason,
          session.primaryGoal,
          session.sessionRecord?.title,
          ...(session.assignedMembers || []).map((member) => member.displayName),
        ].join(' ').toLowerCase().includes(normalizedQuery)
      })
      .sort((left, right) => (
        (bandOrder[left.followThrough?.band] ?? 9) - (bandOrder[right.followThrough?.band] ?? 9)
        || new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
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

  function openClientResources(session) {
    if (session.clientProfileId) navigate(`/admin/clients/${session.clientProfileId}/resources`)
    else navigate('/admin/clients')
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page pwc-momentum18-page">
        <header className="pwc-week16-hero pwc-momentum18-hero">
          <div>
            <p className="admin-eyebrow">Session Follow-Through</p>
            <h1>Carry each session into a clear next chapter.</h1>
            <p>
              Review recently completed and missed sessions, document context, close overdue
              care, share resources, and set the next human touchpoint before continuity is lost.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Session follow-through access">
            <span aria-hidden="true">↻</span>
            <div>
              <small>{roleLabel(adminUser?.role)} view</small>
              <strong>{snapshot.viewer?.teamWide ? 'Studio-wide session continuity' : 'My assigned-client sessions'}</strong>
              <p>This is an operational continuity signal, not a rating of the client or the session.</p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-momentum18-toolbar" aria-label="Session follow-through controls">
          <div>
            <small>Continuity horizon</small>
            <strong>Recent sessions and the care that should follow them</strong>
          </div>
          <label>
            <span className="sr-only">Follow-through horizon</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={14}>Past 14 days</option>
              <option value={30}>Past 30 days</option>
              <option value={60}>Past 60 days</option>
            </select>
          </label>
          <button type="button" disabled={refreshing} onClick={() => loadFollowThrough({ quiet: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh follow-through'}
          </button>
        </section>

        {error && <div className="pwc-week16-message is-error" role="alert">{error}</div>}

        <section className="pwc-week16-metrics" aria-label="Session follow-through summary">
          <article>
            <span>Recent sessions</span>
            <strong>{snapshot.summary?.total || 0}</strong>
            <p>Within the past {snapshot.horizonDays || days} days</p>
          </article>
          <article className={(snapshot.summary?.reconcile || snapshot.summary?.recovery) ? 'is-danger' : ''}>
            <span>Status or recovery</span>
            <strong>{(snapshot.summary?.reconcile || 0) + (snapshot.summary?.recovery || 0)}</strong>
            <p>Past sessions requiring immediate clarification</p>
          </article>
          <article className={(snapshot.summary?.overdue || snapshot.summary?.notes) ? 'is-warning' : ''}>
            <span>Care to close</span>
            <strong>{(snapshot.summary?.overdue || 0) + (snapshot.summary?.notes || 0)}</strong>
            <p>Overdue follow-up or missing documentation</p>
          </article>
          <article>
            <span>Continuity set</span>
            <strong>{snapshot.summary?.complete || 0}</strong>
            <p>{snapshot.summary?.waitingOnTeam || 0} with conversations waiting</p>
          </article>
        </section>

        <section className="pwc-week16-filters" aria-label="Session follow-through filters">
          <label className="pwc-week16-search">
            <span>Search sessions</span>
            <input
              type="search"
              value={query}
              placeholder="Client, session, owner, goal, or next step"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Continuity signal</span>
            <select value={band} onChange={(event) => setBand(event.target.value)}>
              <option value="all">All signals</option>
              <option value="reconcile">Status needs update</option>
              <option value="recovery">Recovery needed</option>
              <option value="overdue">Follow-up overdue</option>
              <option value="notes">Notes needed</option>
              <option value="next">Next step needed</option>
              <option value="complete">Continuity set</option>
            </select>
          </label>
          <label>
            <span>Session status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All recent statuses</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading session follow-through">
            <span />
            <p>Reviewing recent session continuity…</p>
          </section>
        ) : (
          <div className="pwc-capacity17-grid pwc-momentum18-grid">
            <section aria-label="Session follow-through board">
              <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
                {filteredSessions.map((session) => {
                  const tone = cardTone(session.followThrough?.band)
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
                          <small>{formatDateTime(session.startsAt, session.timezone)}</small>
                          <strong>{session.clientName}</strong>
                        </span>
                        <em>{bandLabel(session.followThrough?.band)}</em>
                      </span>
                      <span>{session.appointmentTypeName} · {statusLabel(session.status)}</span>
                      <p>{session.followThrough?.primaryReason}</p>
                      <span className="pwc-capacity17-card-stats">
                        <small>{session.sessionRecord ? 'Notes recorded' : 'No session record'}</small>
                        <small>{session.activeTasks || 0} active actions</small>
                        <small>{session.resourcesShared || 0} resources shared</small>
                      </span>
                    </button>
                  )
                })}

                {!filteredSessions.length && (
                  <div className="pwc-week16-empty">
                    <strong>No sessions match these filters.</strong>
                    <p>Reset the filters or expand the follow-through horizon.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="pwc-momentum18-detail" aria-label="Selected session follow-through">
              {selectedSession ? (
                <>
                  <header>
                    <div>
                      <small>{bandLabel(selectedSession.followThrough?.band)}</small>
                      <h2>{selectedSession.clientName}</h2>
                      <p>{selectedSession.appointmentTypeName} · {formatDateTime(selectedSession.startsAt, selectedSession.timezone)}</p>
                    </div>
                    <span>{selectedSession.followThrough?.score || 0}</span>
                  </header>

                  <dl className="pwc-momentum18-facts">
                    <div><dt>Session status</dt><dd>{statusLabel(selectedSession.status)}</dd></div>
                    <div><dt>Session record</dt><dd>{selectedSession.sessionRecord ? 'Recorded' : 'Not recorded'}</dd></div>
                    <div><dt>Follow-up date</dt><dd>{formatDate(selectedSession.sessionRecord?.followUpAt)}</dd></div>
                    <div><dt>Next session</dt><dd>{formatDate(selectedSession.nextSessionAt)}</dd></div>
                    <div><dt>Active actions</dt><dd>{selectedSession.activeTasks || 0}</dd></div>
                    <div><dt>Shared resources</dt><dd>{selectedSession.resourcesShared || 0}</dd></div>
                  </dl>

                  <section className="pwc-momentum18-focus">
                    <header><h3>Session context</h3><span>{selectedSession.assignedMembers?.length || 0}</span></header>
                    <strong>{selectedSession.sessionRecord?.title || selectedSession.primaryGoal || 'Session context needs documentation'}</strong>
                    <p>
                      {selectedSession.sessionRecord?.summary
                        || selectedSession.adminNotes
                        || 'Use Client 360 or Sessions to record what happened and what the client needs next.'}
                    </p>
                    <small>
                      {(selectedSession.assignedMembers || []).map((member) => member.displayName).join(', ')
                        || 'No Studio team member assigned'}
                    </small>
                  </section>

                  <section className="pwc-momentum18-reasons">
                    <header><h3>Continuity review</h3><span>{selectedSession.followThrough?.reasons?.length || 0}</span></header>
                    {(selectedSession.followThrough?.reasons || []).length ? (
                      <ul>
                        {selectedSession.followThrough.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    ) : (
                      <p>Session notes and the next care step are in place.</p>
                    )}
                  </section>

                  <section className="pwc-momentum18-actions">
                    <button type="button" onClick={() => openClient(selectedSession)}>Open client context</button>
                    <button type="button" onClick={() => navigate('/admin/scheduler')}>Open Sessions</button>
                    <button type="button" onClick={() => navigate('/admin/attention')}>Open Attention Queue</button>
                    <button type="button" onClick={() => navigate('/admin/inbox')}>Open Secure Inbox</button>
                    <button type="button" onClick={() => openClientResources(selectedSession)}>Open client resources</button>
                  </section>
                </>
              ) : (
                <div className="pwc-week16-empty">
                  <strong>Select a recent session.</strong>
                  <p>Its notes, care actions, messages, resources, and next-session continuity will appear here.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}

export default AdminSessionFollowThrough
