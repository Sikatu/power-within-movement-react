import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminAdvancedFilterToggle from '../../components/admin/AdminAdvancedFilterToggle.jsx'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getAdminClientCoverage } from '../../lib/nativeApi.js'

const coverageOrder = {
  unowned: 0,
  handoff: 1,
  coverage: 2,
  backup: 3,
  watch: 4,
  covered: 5,
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

function signalLabel(band) {
  const labels = {
    unowned: 'Owner needed',
    handoff: 'Handoff needed',
    coverage: 'Coverage needed',
    backup: 'Backup ready',
    watch: 'Coordinate closely',
    covered: 'Coverage in place',
  }
  return labels[band] || 'Coverage review'
}

function availabilityLabel(status) {
  const labels = {
    available: 'Available',
    focused: 'Focused',
    limited: 'Limited',
    away: 'Away',
  }
  return labels[status] || 'Unknown'
}

function assignmentLabel(role) {
  const labels = {
    primary: 'Primary',
    support: 'Support',
    specialist: 'Specialist',
    observer: 'Observer',
  }
  return labels[role] || 'Support'
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

function sessionWindow(value) {
  if (!value) return 'none'
  const difference = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(difference) || difference < 0) return 'none'
  const days = Math.ceil(difference / 86400000)
  if (days <= 7) return '7'
  if (days <= 14) return '14'
  if (days <= 30) return '30'
  return 'later'
}

function AdminClientCoverage() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [snapshot, setSnapshot] = useState({ summary: {}, clients: [], viewer: {} })
  const [selectedClientId, setSelectedClientId] = useState('')
  const [query, setQuery] = useState('')
  const [signal, setSignal] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [session, setSession] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const role = adminUser?.role || 'staff'

  const loadCoverage = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getAdminClientCoverage()
      setSnapshot(response)
      setSelectedClientId((current) => (
        response.clients?.some((client) => client.id === current)
          ? current
          : response.clients?.[0]?.id || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'Client coverage could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCoverage, 0)
    return () => window.clearTimeout(timer)
  }, [loadCoverage])

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (snapshot.clients || [])
      .filter((client) => {
        if (signal !== 'all' && client.coverage?.band !== signal) return false
        if (availability !== 'all') {
          const statuses = (client.assignments || []).map((member) => member.availabilityStatus)
          if (availability === 'unassigned' && client.assignments?.length) return false
          if (availability !== 'unassigned' && !statuses.includes(availability)) return false
        }
        if (session !== 'all' && sessionWindow(client.nextSessionAt) !== session) return false
        if (!normalizedQuery) return true

        return [
          client.name,
          client.email,
          client.primaryGoal,
          client.transformationFocus,
          client.coverage?.primaryReason,
          ...(client.assignments || []).flatMap((member) => [member.displayName, member.assignmentRole]),
          ...(client.tasks || []).flatMap((task) => [task.title, task.ownerName]),
        ].join(' ').toLowerCase().includes(normalizedQuery)
      })
      .sort((left, right) => (
        (coverageOrder[left.coverage?.band] ?? 9) - (coverageOrder[right.coverage?.band] ?? 9)
        || (right.overdueTasks || 0) - (left.overdueTasks || 0)
        || left.name.localeCompare(right.name)
      ))
  }, [availability, query, session, signal, snapshot.clients])

  const selectedClient = useMemo(() => (
    filteredClients.find((client) => client.id === selectedClientId)
      || filteredClients[0]
      || null
  ), [filteredClients, selectedClientId])

  function resetFilters() {
    setQuery('')
    setSignal('all')
    setAvailability('all')
    setSession('all')
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page pwc-momentum18-page">
        <header className="pwc-week16-hero pwc-momentum18-hero">
          <div>
            <p className="admin-eyebrow">Studio Coverage & Handoffs</p>
            <h1>Keep every client relationship covered through team changes.</h1>
            <p>
              See unclear ownership, limited availability, backup coverage, urgent care,
              waiting conversations, and approaching sessions in one role-aware view.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Client coverage access">
            <span aria-hidden="true">⇄</span>
            <div>
              <small>{roleLabel(role)} view</small>
              <strong>{snapshot.viewer?.teamWide ? 'Studio-wide coverage' : 'My assigned clients'}</strong>
              <p>This is an operational continuity signal, not a performance score.</p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-momentum18-toolbar" aria-label="Coverage controls">
          <div>
            <small>Ownership continuity</small>
            <strong>Assignments, availability, active care, and upcoming client touchpoints</strong>
          </div>
          <button type="button" disabled={refreshing} onClick={() => loadCoverage({ quiet: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh coverage'}
          </button>
        </section>

        {error && <div className="pwc-week16-message is-error" role="alert">{error}</div>}

        <section className="pwc-week16-metrics" aria-label="Coverage summary">
          <article>
            <span>Active clients</span>
            <strong>{snapshot.summary?.activeClients || 0}</strong>
            <p>{snapshot.summary?.coveredClients || 0} fully covered</p>
          </article>
          <article className={snapshot.summary?.unownedClients ? 'is-danger' : ''}>
            <span>Owner needed</span>
            <strong>{snapshot.summary?.unownedClients || 0}</strong>
            <p>Clients without an assigned team member</p>
          </article>
          <article className={snapshot.summary?.handoffNeeded ? 'is-warning' : ''}>
            <span>Coverage needed</span>
            <strong>{snapshot.summary?.handoffNeeded || 0}</strong>
            <p>Limited or unavailable ownership</p>
          </article>
          <article className={snapshot.summary?.waitingOnTeam ? 'is-warning' : ''}>
            <span>Waiting on team</span>
            <strong>{snapshot.summary?.waitingOnTeam || 0}</strong>
            <p>Open client conversations</p>
          </article>
        </section>

        <section className={`pwc-week16-filters pwc-ops36-filters${filtersOpen ? ' is-open' : ''}`} aria-label="Coverage filters">
          <label className="pwc-week16-search">
            <span>Search coverage</span>
            <input
              type="search"
              value={query}
              placeholder="Client, team member, care item, or concern"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <AdminAdvancedFilterToggle
            open={filtersOpen}
            activeCount={[signal !== 'all', availability !== 'all', session !== 'all'].filter(Boolean).length}
            onToggle={() => setFiltersOpen((current) => !current)}
          />
          <label>
            <span>Coverage signal</span>
            <select value={signal} onChange={(event) => setSignal(event.target.value)}>
              <option value="all">All signals</option>
              <option value="unowned">Owner needed</option>
              <option value="handoff">Handoff needed</option>
              <option value="coverage">Coverage needed</option>
              <option value="backup">Backup ready</option>
              <option value="watch">Coordinate closely</option>
              <option value="covered">Coverage in place</option>
            </select>
          </label>
          <label>
            <span>Team availability</span>
            <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
              <option value="all">All availability</option>
              <option value="unassigned">Unassigned</option>
              <option value="available">Available</option>
              <option value="focused">Focused</option>
              <option value="limited">Limited</option>
              <option value="away">Away</option>
            </select>
          </label>
          <label>
            <span>Next session</span>
            <select value={session} onChange={(event) => setSession(event.target.value)}>
              <option value="all">Any timing</option>
              <option value="7">Within 7 days</option>
              <option value="14">Within 14 days</option>
              <option value="30">Within 30 days</option>
              <option value="later">Later than 30 days</option>
              <option value="none">No session booked</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading client coverage">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </section>
        ) : (
          <div className="pwc-capacity17-grid pwc-momentum18-grid">
            <section aria-label="Client coverage board">
              <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
                {filteredClients.map((client) => {
                  const selected = client.id === selectedClient?.id
                  return (
                    <button
                      className={`pwc-capacity17-card pwc-momentum18-card is-${client.coverage?.band || 'watch'}${selected ? ' is-selected' : ''}`}
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <span className="pwc-capacity17-card-heading">
                        <span>
                          <small>{client.assignments?.length || 0} assigned · {client.upcomingSessions || 0} upcoming</small>
                          <strong>{client.name}</strong>
                          <em>{client.email || 'No portal email'}</em>
                        </span>
                        <b>{client.coverage?.score ?? 0}</b>
                      </span>
                      <span className="pwc-capacity17-meter" aria-label={`${client.coverage?.score || 0} percent coverage attention signal`}>
                        <i style={{ width: `${client.coverage?.score || 0}%` }} />
                      </span>
                      <span className="pwc-capacity17-signal">
                        <strong>{signalLabel(client.coverage?.band)}</strong>
                        <small>{client.coverage?.primaryReason}</small>
                      </span>
                      <span className="pwc-capacity17-stats">
                        <span><b>{client.activeTasks}</b><small>Active tasks</small></span>
                        <span><b>{client.overdueTasks}</b><small>Overdue</small></span>
                        <span><b>{client.waitingOnTeam}</b><small>Waiting</small></span>
                        <span><b>{client.coverage?.availableOwnerCount || 0}</b><small>Available</small></span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {!filteredClients.length && (
                <div className="pwc-capacity17-empty pwc-momentum18-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No clients match these coverage filters</h3>
                  <p>Reset the filters or broaden the search to review more client relationships.</p>
                </div>
              )}
            </section>

            <aside className="pwc-capacity17-detail pwc-momentum18-detail" aria-label="Selected client coverage">
              {selectedClient ? (
                <>
                  <header>
                    <div>
                      <p className="admin-eyebrow">Selected client</p>
                      <h2>{selectedClient.name}</h2>
                      <small>{formatDate(selectedClient.nextSessionAt, 'No upcoming session')}</small>
                    </div>
                    <span className={`is-${selectedClient.coverage?.band}`}>{signalLabel(selectedClient.coverage?.band)}</span>
                  </header>

                  <dl>
                    <div><dt>Assigned team</dt><dd>{selectedClient.assignments?.length || 0}</dd></div>
                    <div><dt>Available coverage</dt><dd>{selectedClient.coverage?.availableOwnerCount || 0}</dd></div>
                    <div><dt>Next session</dt><dd>{formatDate(selectedClient.nextSessionAt)}</dd></div>
                    <div><dt>Upcoming sessions</dt><dd>{selectedClient.upcomingSessions || 0}</dd></div>
                    <div><dt>Open conversations</dt><dd>{selectedClient.openConversations || 0}</dd></div>
                    <div><dt>Active care items</dt><dd>{selectedClient.activeTasks || 0}</dd></div>
                  </dl>

                  <section className="pwc-momentum18-focus">
                    <header><h3>Assigned coverage</h3><span>{selectedClient.assignments?.length || 0}</span></header>
                    {(selectedClient.assignments || []).length ? (
                      <ul>
                        {selectedClient.assignments.map((member) => (
                          <li key={member.id}>
                            <strong>{member.displayName}</strong>
                            <span>{assignmentLabel(member.assignmentRole)} · {availabilityLabel(member.availabilityStatus)} · {member.capacityPercent}% capacity</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No Studio team member is assigned to this client.</p>
                    )}
                  </section>

                  <section className="pwc-momentum18-reasons">
                    <header><h3>Handoff review</h3><span>{selectedClient.coverage?.reasons?.length || 0}</span></header>
                    {(selectedClient.coverage?.reasons || []).length ? (
                      <ul>
                        {selectedClient.coverage.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    ) : (
                      <p>Client ownership and backup coverage are in place.</p>
                    )}
                  </section>

                  <section className="pwc-momentum18-focus">
                    <header><h3>Active care work</h3><span>{selectedClient.tasks?.length || 0}</span></header>
                    {(selectedClient.tasks || []).length ? (
                      <ul>
                        {selectedClient.tasks.slice(0, 5).map((task) => (
                          <li key={`${task.sourceType}:${task.id}`}>
                            <strong>{task.title}</strong>
                            <span>{task.ownerName || 'Unassigned'} · {task.priority || 'normal'} · {formatDate(task.dueAt, 'No due date')}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No active care actions or lead follow-ups.</p>
                    )}
                  </section>

                  <section className="pwc-momentum18-actions">
                    <button type="button" onClick={() => navigate(`/admin/client-360/${selectedClient.id}`)}>Open client context</button>
                    <button type="button" onClick={() => navigate(`/admin/attention?client=${encodeURIComponent(selectedClient.id)}`)}>Open Attention Queue</button>
                    <button type="button" onClick={() => navigate('/admin/capacity')}>Open Studio Capacity</button>
                    <button type="button" onClick={() => navigate('/admin/scheduler')}>Open Sessions</button>
                    <button type="button" onClick={() => navigate('/admin/inbox')}>Open Secure Inbox</button>
                    {role === 'developer' && (
                      <button type="button" onClick={() => navigate('/admin/team')}>Manage client assignments</button>
                    )}
                  </section>
                </>
              ) : (
                <div className="pwc-week16-empty">
                  <strong>Select a client relationship.</strong>
                  <p>Assigned owners, availability, care pressure, and handoff needs will appear here.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}

export default AdminClientCoverage
