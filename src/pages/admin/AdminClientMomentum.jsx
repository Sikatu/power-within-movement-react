import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getAdminClientMomentum } from '../../lib/nativeApi.js'

const signalOrder = {
  attention: 0,
  watch: 1,
  paused: 2,
  steady: 3,
  complete: 4,
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
  const labels = {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }
  return labels[role] || 'Private account'
}

function stageLabel(value) {
  const labels = {
    onboarding: 'Onboarding',
    clarity: 'Clarity',
    active_work: 'Active work',
    integration: 'Integration',
    maintenance: 'Maintenance',
    complete: 'Complete',
  }
  return labels[value] || 'Onboarding'
}

function careLabel(value) {
  const labels = {
    not_started: 'Not started',
    on_track: 'On track',
    attention: 'Needs attention',
    paused: 'Paused',
    completed: 'Completed',
  }
  return labels[value] || 'Not started'
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

function relativeTouch(days) {
  if (days === null || days === undefined) return 'No touchpoint recorded'
  if (days === 0) return 'Touched today'
  if (days === 1) return 'Touched yesterday'
  return `Touched ${days} days ago`
}

function signalLabel(band) {
  const labels = {
    attention: 'Needs attention',
    watch: 'Watch closely',
    paused: 'Paused',
    steady: 'Steady momentum',
    complete: 'Journey complete',
  }
  return labels[band] || 'Momentum review'
}

function taskKey(task) {
  return `${task.sourceType}:${task.id}`
}

function AdminClientMomentum() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [snapshot, setSnapshot] = useState({
    summary: {},
    clients: [],
    viewer: {},
  })
  const [selectedClientId, setSelectedClientId] = useState('')
  const [query, setQuery] = useState('')
  const [signal, setSignal] = useState('all')
  const [stage, setStage] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const role = adminUser?.role || 'staff'

  const loadMomentum = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getAdminClientMomentum()
      setSnapshot(response)
      setSelectedClientId((current) => (
        response.clients?.some((client) => client.id === current)
          ? current
          : response.clients?.[0]?.id || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'Client momentum could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadMomentum, 0)
    return () => window.clearTimeout(timer)
  }, [loadMomentum])

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (snapshot.clients || [])
      .filter((client) => {
        if (signal !== 'all' && client.signal?.band !== signal) return false
        if (stage !== 'all' && client.journeyStage !== stage) return false
        if (ownership === 'assigned' && !client.assignedMembers?.length) return false
        if (ownership === 'unassigned' && client.assignedMembers?.length) return false
        if (!normalizedQuery) return true

        return [
          client.name,
          client.email,
          client.primaryGoal,
          client.transformationFocus,
          client.signal?.primaryReason,
          ...(client.assignedMembers || []).map((member) => member.displayName),
        ].join(' ').toLowerCase().includes(normalizedQuery)
      })
      .sort((left, right) => (
        (signalOrder[left.signal?.band] ?? 9) - (signalOrder[right.signal?.band] ?? 9)
        || (right.overdueTasks || 0) - (left.overdueTasks || 0)
        || left.name.localeCompare(right.name)
      ))
  }, [ownership, query, signal, snapshot.clients, stage])

  const selectedClient = useMemo(() => (
    filteredClients.find((client) => client.id === selectedClientId)
      || filteredClients[0]
      || null
  ), [filteredClients, selectedClientId])

  function resetFilters() {
    setQuery('')
    setSignal('all')
    setStage('all')
    setOwnership('all')
  }

  function openClient(clientId) {
    navigate(`/admin/client-360/${clientId}`)
  }

  function openClientTasks(clientId) {
    navigate(`/admin/attention?client=${encodeURIComponent(clientId)}`)
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page pwc-momentum18-page">
        <header className="pwc-week16-hero pwc-momentum18-hero">
          <div>
            <p className="admin-eyebrow">Client Momentum</p>
            <h1>See where thoughtful care needs the next human touch.</h1>
            <p>
              Bring care plans, sessions, conversations, learning, and accountable
              actions into one calm operational signal for every active client.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Momentum access">
            <span aria-hidden="true">↗</span>
            <div>
              <small>{roleLabel(role)} view</small>
              <strong>{snapshot.viewer?.teamWide ? 'Studio-wide momentum' : 'My assigned clients'}</strong>
              <p>
                This is an operational care signal, not a rating of a client or their progress.
              </p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-momentum18-toolbar" aria-label="Momentum controls">
          <div>
            <small>Operational care signal</small>
            <strong>Recent touchpoints plus accountable next steps</strong>
          </div>
          <button type="button" disabled={refreshing} onClick={() => loadMomentum({ quiet: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh momentum'}
          </button>
        </section>

        {error && <div className="pwc-week16-message is-error" role="alert">{error}</div>}

        <section className="pwc-week16-metrics" aria-label="Client momentum summary">
          <article>
            <span>Active clients</span>
            <strong>{snapshot.summary?.activeClients || 0}</strong>
            <p>{snapshot.summary?.steadyMomentum || 0} with steady momentum</p>
          </article>
          <article className={snapshot.summary?.needsAttention ? 'is-danger' : ''}>
            <span>Needs attention</span>
            <strong>{snapshot.summary?.needsAttention || 0}</strong>
            <p>Immediate operational follow-through</p>
          </article>
          <article className={snapshot.summary?.overdueReviews ? 'is-warning' : ''}>
            <span>Overdue reviews</span>
            <strong>{snapshot.summary?.overdueReviews || 0}</strong>
            <p>Care plans ready for review</p>
          </article>
          <article className={snapshot.summary?.waitingOnTeam ? 'is-warning' : ''}>
            <span>Waiting on team</span>
            <strong>{snapshot.summary?.waitingOnTeam || 0}</strong>
            <p>Open client conversations</p>
          </article>
        </section>

        <section className="pwc-week16-filters" aria-label="Momentum filters">
          <label className="pwc-week16-search">
            <span>Search clients</span>
            <input
              type="search"
              value={query}
              placeholder="Name, goal, team member, or care signal"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Momentum</span>
            <select value={signal} onChange={(event) => setSignal(event.target.value)}>
              <option value="all">All signals</option>
              <option value="attention">Needs attention</option>
              <option value="watch">Watch closely</option>
              <option value="steady">Steady momentum</option>
              <option value="paused">Paused</option>
              <option value="complete">Journey complete</option>
            </select>
          </label>
          <label>
            <span>Journey stage</span>
            <select value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="all">All stages</option>
              <option value="onboarding">Onboarding</option>
              <option value="clarity">Clarity</option>
              <option value="active_work">Active work</option>
              <option value="integration">Integration</option>
              <option value="maintenance">Maintenance</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <label>
            <span>Ownership</span>
            <select value={ownership} onChange={(event) => setOwnership(event.target.value)}>
              <option value="all">All ownership</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Needs assignment</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading client momentum">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </section>
        ) : (
          <div className="pwc-capacity17-grid pwc-momentum18-grid">
            <section aria-label="Client momentum board">
              <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
                {filteredClients.map((client) => {
                  const selected = client.id === selectedClient?.id
                  return (
                    <button
                      className={`pwc-capacity17-card pwc-momentum18-card is-${client.signal?.band || 'watch'}${selected ? ' is-selected' : ''}`}
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <span className="pwc-capacity17-card-heading">
                        <span>
                          <small>{stageLabel(client.journeyStage)} · {careLabel(client.careStatus)}</small>
                          <strong>{client.name}</strong>
                          <em>{client.email || 'No portal email'}</em>
                        </span>
                        <b>{client.signal?.score ?? 0}</b>
                      </span>
                      <span className="pwc-capacity17-meter" aria-label={`${client.signal?.score || 0} percent momentum signal`}>
                        <i style={{ width: `${client.signal?.score || 0}%` }} />
                      </span>
                      <span className="pwc-capacity17-signal">
                        <strong>{signalLabel(client.signal?.band)}</strong>
                        <small>{client.signal?.primaryReason}</small>
                      </span>
                      <span className="pwc-capacity17-stats">
                        <span><b>{client.activeTasks}</b><small>Active tasks</small></span>
                        <span><b>{client.overdueTasks}</b><small>Overdue</small></span>
                        <span><b>{client.waitingOnTeam}</b><small>Waiting</small></span>
                        <span><b>{client.lessonProgressPercent}%</b><small>Learning</small></span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {!filteredClients.length && (
                <div className="pwc-capacity17-empty pwc-momentum18-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No clients match these filters</h3>
                  <p>Reset the filters or broaden the search to review more care journeys.</p>
                </div>
              )}
            </section>

            {selectedClient ? (
              <aside className="pwc-capacity17-detail pwc-momentum18-detail" aria-label={`${selectedClient.name} momentum details`}>
                <header>
                  <div>
                    <p className="admin-eyebrow">Selected client</p>
                    <h2>{selectedClient.name}</h2>
                    <small>{relativeTouch(selectedClient.signal?.lastTouchDays)}</small>
                  </div>
                  <span className={`is-${selectedClient.signal?.band}`}>{signalLabel(selectedClient.signal?.band)}</span>
                </header>

                <dl>
                  <div><dt>Journey stage</dt><dd>{stageLabel(selectedClient.journeyStage)}</dd></div>
                  <div><dt>Care status</dt><dd>{careLabel(selectedClient.careStatus)}</dd></div>
                  <div><dt>Next session</dt><dd>{formatDate(selectedClient.nextSessionAt)}</dd></div>
                  <div><dt>Next review</dt><dd>{formatDate(selectedClient.nextReviewAt)}</dd></div>
                  <div><dt>Completed sessions</dt><dd>{selectedClient.completedSessions}</dd></div>
                  <div><dt>Active membership</dt><dd>{selectedClient.activeMemberships ? 'Yes' : 'No'}</dd></div>
                </dl>

                <section className="pwc-momentum18-focus">
                  <header><h3>Care focus</h3><span>{selectedClient.assignedMembers?.length || 0}</span></header>
                  <strong>{selectedClient.primaryGoal || 'Primary goal not recorded'}</strong>
                  <p>{selectedClient.transformationFocus || selectedClient.clientVisibleFocus || 'Add the current transformation focus in Client 360.'}</p>
                  <small>
                    {(selectedClient.assignedMembers || []).map((member) => member.displayName).join(', ') || 'No Studio owner assigned'}
                  </small>
                </section>

                <section>
                  <header><h3>Signals to review</h3><span>{selectedClient.signal?.reasons?.length || 0}</span></header>
                  <div className="pwc-momentum18-reasons">
                    {(selectedClient.signal?.reasons?.length
                      ? selectedClient.signal.reasons
                      : ['No immediate operational concern']
                    ).map((reason) => <p key={reason}>{reason}</p>)}
                  </div>
                </section>

                <section>
                  <header><h3>Open care actions</h3><span>{selectedClient.tasks?.length || 0}</span></header>
                  <div className="pwc-capacity17-detail-list">
                    {(selectedClient.tasks || []).slice(0, 6).map((task) => (
                      <button
                        className="pwc-capacity17-session pwc-momentum18-task"
                        key={taskKey(task)}
                        type="button"
                        onClick={() => openClientTasks(selectedClient.id)}
                      >
                        <span>{task.sourceLabel} · {task.priority}</span>
                        <strong>{task.title}</strong>
                        <small>{task.dueAt ? `Due ${formatDate(task.dueAt)}` : 'No due date'} · {task.ownerName}</small>
                      </button>
                    ))}
                    {!selectedClient.tasks?.length && <p className="pwc-capacity17-empty-copy">No active care actions.</p>}
                  </div>
                </section>

                <div className="pwc-momentum18-actions">
                  <button type="button" onClick={() => openClient(selectedClient.id)}>Open Client 360</button>
                  <button type="button" onClick={() => openClientTasks(selectedClient.id)}>Open attention work</button>
                  <button type="button" onClick={() => navigate('/admin/scheduler')}>Review sessions</button>
                </div>
              </aside>
            ) : (
              <aside className="pwc-capacity17-empty pwc-momentum18-empty">
                <span aria-hidden="true">○</span>
                <h3>Select a client</h3>
                <p>Choose a client card to review their current care signal.</p>
              </aside>
            )}
          </div>
        )}
      </div>
    </AdminFrame>
  )
}

export default AdminClientMomentum
