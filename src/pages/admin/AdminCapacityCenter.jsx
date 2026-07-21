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
  getAdminTeamWorkload,
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

function roleLabel(role) {
  return {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }[role] || 'Private account'
}

function availabilityLabel(status) {
  return {
    available: 'Available',
    focused: 'Focused',
    limited: 'Limited',
    away: 'Away',
  }[status] || 'Available'
}

function loadLabel(band) {
  return {
    light: 'Room available',
    balanced: 'Balanced',
    high: 'Near capacity',
    overloaded: 'Needs rebalancing',
  }[band] || 'Balanced'
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

function withinDays(value, days) {
  if (!value) return false
  const date = new Date(value).getTime()
  if (!Number.isFinite(date)) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date >= today.getTime() && date < today.getTime() + (days * 86_400_000)
}

function taskKey(task) {
  return `${task.sourceType}:${task.id}`
}

export default function AdminCapacityCenter() {
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedUser)
  const [teamAccess, setTeamAccess] = useState(null)
  const [snapshot, setSnapshot] = useState({
    summary: {},
    members: [],
    tasks: [],
    sessions: [],
    unassignedTasks: [],
  })
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [query, setQuery] = useState('')
  const [band, setBand] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [horizon, setHorizon] = useState(7)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const role = adminUser?.role || 'staff'
  const isStaff = role === 'staff'
  const canManageTasks = !isStaff || teamAccess?.permissions?.clients === 'manage'

  const loadCapacity = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const [workloadResponse, accessResponse] = await Promise.all([
        getAdminTeamWorkload(),
        isStaff ? getMyTeamAccess().catch(() => null) : Promise.resolve(null),
      ])

      setSnapshot(workloadResponse)
      setTeamAccess(accessResponse?.access || null)
      setSelectedMemberId((current) => (
        workloadResponse.members?.some((member) => member.id === current)
          ? current
          : workloadResponse.members?.[0]?.id || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'Studio capacity could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isStaff])

  useEffect(() => {
    const timer = window.setTimeout(loadCapacity, 0)
    return () => window.clearTimeout(timer)
  }, [loadCapacity])

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (snapshot.members || []).filter((member) => {
      if (band !== 'all' && member.band !== band) return false
      if (availability !== 'all' && member.availabilityStatus !== availability) return false
      if (!normalizedQuery) return true

      return [
        member.displayName,
        member.email,
        member.jobTitle,
        member.department,
        loadLabel(member.band),
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [availability, band, query, snapshot.members])

  const selectedMember = useMemo(() => (
    snapshot.members?.find((member) => member.id === selectedMemberId)
      || filteredMembers[0]
      || null
  ), [filteredMembers, selectedMemberId, snapshot.members])

  const selectedTasks = useMemo(() => (
    selectedMember
      ? (snapshot.tasks || []).filter((task) => task.ownerUserId === selectedMember.id)
      : []
  ), [selectedMember, snapshot.tasks])

  const selectedSessions = useMemo(() => (
    selectedMember
      ? (snapshot.sessions || []).filter((session) => (
        session.memberIds.includes(selectedMember.id)
        && withinDays(session.startsAt, horizon)
      ))
      : []
  ), [horizon, selectedMember, snapshot.sessions])

  const visibleUnassigned = useMemo(() => (
    (snapshot.unassignedTasks || []).filter((task) => {
      const normalizedQuery = query.trim().toLowerCase()
      if (!normalizedQuery) return true
      return [task.title, task.clientName, task.sourceLabel]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  ), [query, snapshot.unassignedTasks])

  function resetFilters() {
    setQuery('')
    setBand('all')
    setAvailability('all')
    setHorizon(7)
  }

  function openTask(task) {
    navigate(task.actionUrl || '/admin/attention')
  }

  function openSession(session) {
    if (session.clientProfileId) {
      navigate(`/admin/client-360/${session.clientProfileId}`)
      return
    }

    navigate('/admin/scheduler')
  }

  async function assignTask(task, ownerUserId) {
    if (!canManageTasks || savingKey || !ownerUserId) return

    setSavingKey(taskKey(task))
    setError('')
    setNotice('')

    try {
      await updateAdminAttentionItem(
        task.sourceType,
        task.clientProfileId,
        task.id,
        { assigneeUserId: ownerUserId },
      )
      await loadCapacity({ quiet: true })
      setNotice('Attention ownership updated.')
    } catch (saveError) {
      setError(saveError.message || 'The attention item could not be reassigned.')
    } finally {
      setSavingKey('')
    }
  }

  function eligibleMembers(task) {
    return (snapshot.members || []).filter((member) => (
      member.isAssignable
      && task.eligibleOwnerIds?.includes(member.id)
    ))
  }

  return (
    <AdminFrame>
      <div className="pwc-week16-page pwc-capacity17-page">
        <header className="pwc-week16-hero pwc-capacity17-hero">
          <div>
            <p className="admin-eyebrow">Studio Capacity</p>
            <h1>Balance ownership before important care becomes invisible.</h1>
            <p>
              Review active tasks, upcoming sessions, client assignments, and
              configured availability in one operational workload signal.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Capacity access">
            <span aria-hidden="true">%</span>
            <div>
              <small>{roleLabel(role)} view</small>
              <strong>{snapshot.viewer?.teamWide ? 'Team-wide capacity' : 'My capacity'}</strong>
              <p>
                {snapshot.viewer?.teamWide
                  ? 'Active administrators and assignable Studio staff are included.'
                  : 'Only your permitted clients, tasks, and sessions are included.'}
              </p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-capacity17-toolbar" aria-label="Capacity controls">
          <div>
            <small>Operational signal</small>
            <strong>Configured capacity plus current accountable work</strong>
          </div>
          <button type="button" disabled={refreshing} onClick={() => loadCapacity({ quiet: true })}>
            {refreshing ? 'Refreshing…' : 'Refresh capacity'}
          </button>
        </section>

        {(error || notice) && (
          <div className={`pwc-week16-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>
            {error || notice}
          </div>
        )}

        <section className="pwc-week16-metrics" aria-label="Capacity summary">
          <article>
            <span>Active team</span>
            <strong>{snapshot.summary?.activeMembers || 0}</strong>
            <p>{snapshot.summary?.availableMembers || 0} available now</p>
          </article>
          <article className={snapshot.summary?.overloadedMembers ? 'is-warning' : ''}>
            <span>Needs rebalancing</span>
            <strong>{snapshot.summary?.overloadedMembers || 0}</strong>
            <p>Above configured capacity</p>
          </article>
          <article className={snapshot.summary?.overdueTasks ? 'is-danger' : ''}>
            <span>Overdue tasks</span>
            <strong>{snapshot.summary?.overdueTasks || 0}</strong>
            <p>Across active ownership</p>
          </article>
          <article className={snapshot.summary?.unassignedTasks ? 'is-warning' : ''}>
            <span>Needs an owner</span>
            <strong>{snapshot.summary?.unassignedTasks || 0}</strong>
            <p>Unassigned attention items</p>
          </article>
        </section>

        <section className={`pwc-week16-filters pwc-ops36-filters${filtersOpen ? ' is-open' : ''}`} aria-label="Capacity filters">
          <label className="pwc-week16-search">
            <span>Search team</span>
            <input
              type="search"
              value={query}
              placeholder="Name, role, department, or task"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <AdminAdvancedFilterToggle
            open={filtersOpen}
            activeCount={[band !== 'all', availability !== 'all', horizon !== 7].filter(Boolean).length}
            onToggle={() => setFiltersOpen((current) => !current)}
          />

          <label>
            <span>Load signal</span>
            <select value={band} onChange={(event) => setBand(event.target.value)}>
              <option value="all">All load levels</option>
              <option value="light">Room available</option>
              <option value="balanced">Balanced</option>
              <option value="high">Near capacity</option>
              <option value="overloaded">Needs rebalancing</option>
            </select>
          </label>

          <label>
            <span>Availability</span>
            <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="focused">Focused</option>
              <option value="limited">Limited</option>
              <option value="away">Away</option>
            </select>
          </label>

          <label>
            <span>Session horizon</span>
            <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </label>

          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading Studio capacity">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </section>
        ) : (
          <div className="pwc-capacity17-grid">
            <section aria-label="Team workload board">
              <div className="pwc-capacity17-cards" aria-live="polite">
                {filteredMembers.map((member) => {
                  const sessionMetric = member.metrics?.[`sessions${horizon}`] || 0
                  const selected = member.id === selectedMember?.id

                  return (
                    <button
                      className={`pwc-capacity17-card is-${member.band}${selected ? ' is-selected' : ''}`}
                      type="button"
                      key={member.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      <span className="pwc-capacity17-card-heading">
                        <span>
                          <small>{member.jobTitle || member.department || roleLabel(member.role)}</small>
                          <strong>{member.displayName}</strong>
                          <em>{availabilityLabel(member.availabilityStatus)}</em>
                        </span>
                        <b>{member.loadPercent}%</b>
                      </span>

                      <span className="pwc-capacity17-meter" aria-label={`${loadLabel(member.band)} at ${member.loadPercent} percent`}>
                        <i style={{ width: `${Math.min(member.loadPercent, 100)}%` }} />
                      </span>

                      <span className="pwc-capacity17-signal">
                        <strong>{loadLabel(member.band)}</strong>
                        <small>{member.capacityPercent}% configured capacity</small>
                      </span>

                      <span className="pwc-capacity17-stats">
                        <span><b>{member.metrics.activeTasks}</b><small>tasks</small></span>
                        <span><b>{member.metrics.overdueTasks}</b><small>overdue</small></span>
                        <span><b>{sessionMetric}</b><small>sessions</small></span>
                        <span><b>{member.metrics.assignedClients}</b><small>clients</small></span>
                      </span>
                    </button>
                  )
                })}

                {!filteredMembers.length && (
                  <div className="pwc-capacity17-empty">
                    <span aria-hidden="true">○</span>
                    <h3>No team capacity matches this view.</h3>
                    <p>Reset the filters to review the full available workload picture.</p>
                    <button type="button" onClick={resetFilters}>Show all capacity</button>
                  </div>
                )}
              </div>

              {visibleUnassigned.length > 0 && (
                <section className="pwc-capacity17-unassigned" aria-label="Attention items needing an owner">
                  <header>
                    <div>
                      <p className="admin-eyebrow">Needs an owner</p>
                      <h2>Assign the work before it drifts.</h2>
                    </div>
                    <span>{visibleUnassigned.length}</span>
                  </header>

                  <div>
                    {visibleUnassigned.slice(0, 8).map((task) => (
                      <article className="pwc-capacity17-task" key={`unassigned-${taskKey(task)}`}>
                        <div>
                          <small>{task.sourceLabel} · {task.priority}</small>
                          <strong>{task.title}</strong>
                          <p>{task.clientName}</p>
                        </div>
                        <div>
                          <button type="button" onClick={() => openTask(task)}>Open</button>
                          {canManageTasks && (
                            <label>
                              <span className="sr-only">Assign {task.title}</span>
                              <select
                                value=""
                                disabled={savingKey === taskKey(task)}
                                onChange={(event) => assignTask(task, event.target.value)}
                              >
                                <option value="">Choose owner…</option>
                                {eligibleMembers(task).map((member) => (
                                  <option key={member.id} value={member.id}>{member.displayName}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </section>

            <aside className="pwc-capacity17-detail" aria-label="Selected team member workload">
              {selectedMember ? (
                <>
                  <header>
                    <div>
                      <p className="admin-eyebrow">Selected workload</p>
                      <h2>{selectedMember.displayName}</h2>
                      <p>{selectedMember.jobTitle || selectedMember.email}</p>
                    </div>
                    <span className={`is-${selectedMember.band}`}>{loadLabel(selectedMember.band)}</span>
                  </header>

                  <dl>
                    <div><dt>Availability</dt><dd>{availabilityLabel(selectedMember.availabilityStatus)}</dd></div>
                    <div><dt>Configured capacity</dt><dd>{selectedMember.capacityPercent}%</dd></div>
                    <div><dt>Open conversations</dt><dd>{selectedMember.metrics.openConversations}</dd></div>
                    <div><dt>Due today</dt><dd>{selectedMember.metrics.dueToday}</dd></div>
                  </dl>

                  <section>
                    <header><h3>Active ownership</h3><span>{selectedTasks.length}</span></header>
                    <div className="pwc-capacity17-detail-list">
                      {selectedTasks.slice(0, 8).map((task) => (
                        <article className="pwc-capacity17-task" key={`owned-${taskKey(task)}`}>
                          <div>
                            <small>{task.sourceLabel} · {task.priority}</small>
                            <strong>{task.title}</strong>
                            <p>{task.clientName}</p>
                          </div>
                          <button type="button" onClick={() => openTask(task)}>Open</button>
                        </article>
                      ))}
                      {!selectedTasks.length && <p className="pwc-capacity17-empty-copy">No active attention items are assigned.</p>}
                    </div>
                  </section>

                  <section>
                    <header><h3>Upcoming sessions</h3><span>{selectedSessions.length}</span></header>
                    <div className="pwc-capacity17-detail-list">
                      {selectedSessions.slice(0, 8).map((session) => (
                        <button className="pwc-capacity17-session" type="button" key={session.id} onClick={() => openSession(session)}>
                          <span>{formatDateTime(session.startsAt)}</span>
                          <strong>{session.clientName}</strong>
                          <small>{session.title}</small>
                        </button>
                      ))}
                      {!selectedSessions.length && <p className="pwc-capacity17-empty-copy">No assigned sessions in this horizon.</p>}
                    </div>
                  </section>

                  <button className="pwc-week16-open-queue" type="button" onClick={() => navigate('/admin/attention')}>
                    Open full attention queue
                  </button>
                </>
              ) : (
                <div className="pwc-capacity17-empty">
                  <span aria-hidden="true">→</span>
                  <h3>Select a team member.</h3>
                  <p>Review accountable work and upcoming sessions here.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
