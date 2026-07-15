import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext.js'
import {
  getAdminAttentionQueue,
  getMyTeamAccess,
  updateAdminAttentionItem,
} from '../../lib/nativeApi.js'

const timingDefinitions = [
  { key: 'all', label: 'All timing' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'this_week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'unscheduled', label: 'No due date' },
]

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function formatDate(value, withTime = false) {
  if (!value) return 'No due date'

  try {
    return new Intl.DateTimeFormat(undefined, withTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function timingBucket(task, now = new Date()) {
  if (!task.dueAt) return 'unscheduled'

  const due = new Date(task.dueAt)
  if (Number.isNaN(due.getTime())) return 'unscheduled'

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const week = new Date(today)
  week.setDate(week.getDate() + 7)

  if (due < today) return 'overdue'
  if (due < tomorrow) return 'today'
  if (due < week) return 'this_week'
  return 'later'
}

function timingLabel(task) {
  return {
    overdue: 'Overdue',
    today: 'Due today',
    this_week: 'Due this week',
    later: 'Scheduled',
    unscheduled: 'No due date',
  }[timingBucket(task)]
}

function priorityLabel(priority) {
  return {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  }[priority] || 'Normal'
}

function roleLabel(role) {
  return {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }[role] || 'Private account'
}

function taskKey(task) {
  return `${task.sourceType}:${task.id}`
}

function draftFromTask(task) {
  return {
    status: task.status,
    priority: task.priority,
    dueAt: toDateInput(task.dueAt),
    assigneeUserId: task.ownerUserId || '',
  }
}

export default function AdminAttentionQueue() {
  const navigate = useNavigate()
  const confirmAction = useAdminConfirm()
  const [adminUser] = useState(readCachedUser)
  const [teamAccess, setTeamAccess] = useState(null)
  const [tasks, setTasks] = useState([])
  const [metrics, setMetrics] = useState({
    total: 0,
    overdue: 0,
    dueToday: 0,
    urgent: 0,
    unassigned: 0,
    inProgress: 0,
  })
  const [teamUsers, setTeamUsers] = useState([])
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [timing, setTiming] = useState('all')
  const [priority, setPriority] = useState('all')
  const [selectedKey, setSelectedKey] = useState('')
  const selectedKeyRef = useRef('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const role = adminUser?.role || 'staff'
  const isStaff = role === 'staff'
  const canManage = !isStaff || teamAccess?.permissions?.clients === 'manage'

  const applyQueueResponse = useCallback((response) => {
    const nextTasks = response.tasks || []
    setTasks(nextTasks)
    setMetrics(response.metrics || {})
    setTeamUsers(response.teamUsers || [])

    const currentKey = selectedKeyRef.current
    const nextSelected = nextTasks.find((task) => taskKey(task) === currentKey)
      || nextTasks[0]
      || null
    const nextKey = nextSelected ? taskKey(nextSelected) : ''

    selectedKeyRef.current = nextKey
    setSelectedKey(nextKey)
    setDraft(nextSelected ? draftFromTask(nextSelected) : null)
  }, [])

  const loadQueue = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const [queueResponse, accessResponse] = await Promise.all([
        getAdminAttentionQueue(),
        isStaff ? getMyTeamAccess().catch(() => null) : Promise.resolve(null),
      ])

      applyQueueResponse(queueResponse)
      setTeamAccess(accessResponse?.access || null)
    } catch (loadError) {
      setError(loadError.message || 'The Studio attention queue could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applyQueueResponse, isStaff])

  useEffect(() => {
    const timer = window.setTimeout(loadQueue, 0)
    return () => window.clearTimeout(timer)
  }, [loadQueue])

  const selectedTask = useMemo(
    () => tasks.find((task) => taskKey(task) === selectedKey) || null,
    [selectedKey, tasks],
  )

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tasks.filter((task) => {
      if (source !== 'all' && task.sourceType !== source) return false
      if (timing !== 'all' && timingBucket(task) !== timing) return false
      if (priority !== 'all' && task.priority !== priority) return false

      if (ownership === 'mine' && task.ownerUserId !== adminUser?.id) return false
      if (ownership === 'unassigned' && task.ownerUserId) return false
      if (ownership === 'assigned' && !task.ownerUserId) return false

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
  }, [adminUser?.id, ownership, priority, query, source, tasks, timing])

  const groupedTasks = useMemo(() => {
    const order = ['overdue', 'today', 'this_week', 'later', 'unscheduled']
    const labels = new Map(timingDefinitions.map((definition) => [definition.key, definition.label]))

    return order
      .map((bucket) => [
        bucket,
        labels.get(bucket),
        filteredTasks.filter((task) => timingBucket(task) === bucket),
      ])
      .filter(([, , items]) => items.length)
  }, [filteredTasks])

  const eligibleOwners = useMemo(() => {
    if (!selectedTask) return []
    if (selectedTask.sourceType === 'lead_follow_up') return teamUsers

    return teamUsers.filter((user) => (
      user.clientProfileIds?.includes(selectedTask.clientProfileId)
      || user.id === selectedTask.ownerUserId
    ))
  }, [selectedTask, teamUsers])

  const draftChanged = useMemo(() => {
    if (!selectedTask || !draft) return false
    const original = draftFromTask(selectedTask)

    return original.status !== draft.status
      || original.priority !== draft.priority
      || original.dueAt !== draft.dueAt
      || original.assigneeUserId !== draft.assigneeUserId
  }, [draft, selectedTask])

  function resetFilters() {
    setQuery('')
    setSource('all')
    setOwnership('all')
    setTiming('all')
    setPriority('all')
  }

  function selectTask(task) {
    const nextKey = taskKey(task)
    selectedKeyRef.current = nextKey
    setSelectedKey(nextKey)
    setDraft(draftFromTask(task))
    setError('')
    setNotice('')
  }

  async function saveTask(nextOverrides = {}) {
    if (!selectedTask || !draft || saving || !canManage) return

    const nextDraft = { ...draft, ...nextOverrides }
    const original = draftFromTask(selectedTask)
    const payload = {}

    if (nextDraft.status !== original.status) payload.status = nextDraft.status
    if (nextDraft.priority !== original.priority) payload.priority = nextDraft.priority
    if (nextDraft.dueAt !== original.dueAt) payload.dueAt = nextDraft.dueAt || null
    if (nextDraft.assigneeUserId !== original.assigneeUserId) {
      payload.assigneeUserId = nextDraft.assigneeUserId || null
    }

    if (!Object.keys(payload).length) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminAttentionItem(
        selectedTask.sourceType,
        selectedTask.clientProfileId,
        selectedTask.id,
        payload,
      )
      applyQueueResponse(response)
      setNotice(response.message || 'Attention item updated.')
    } catch (saveError) {
      setError(saveError.message || 'The attention item could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function completeTask(task) {
    if (!canManage || saving) return
    selectTask(task)

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminAttentionItem(
        task.sourceType,
        task.clientProfileId,
        task.id,
        { status: 'completed' },
      )
      applyQueueResponse(response)
      setNotice(response.message || 'Attention item completed.')
    } catch (saveError) {
      setError(saveError.message || 'The attention item could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelTask() {
    if (!selectedTask || !canManage || saving) return

    const confirmed = await confirmAction({
      title: 'Cancel this attention item?',
      message: selectedTask.title,
      detail: 'The item will leave the active queue. It can still be reviewed from its client workspace.',
      confirmLabel: 'Cancel item',
      cancelLabel: 'Keep active',
      tone: 'warning',
    })

    if (!confirmed) return
    await saveTask({ status: 'cancelled' })
  }

  return (
    <AdminFrame>
      <div className="pwc-attention14-page">
        <header className="pwc-attention14-hero">
          <div>
            <p className="admin-eyebrow">Studio Attention Queue</p>
            <h1>Every follow-up that cannot slip, in one accountable view.</h1>
            <p>
              Bring lead follow-ups and client care actions together, clarify
              ownership, protect due dates, and close the loop without losing
              context across separate workspaces.
            </p>
          </div>

          <aside className="pwc-attention14-role-card" aria-label="Queue access level">
            <span aria-hidden="true">{roleLabel(role).charAt(0)}</span>
            <div>
              <small>Your queue access</small>
              <strong>{roleLabel(role)}</strong>
              <p>
                {canManage
                  ? 'You can update ownership, timing, priority, and completion.'
                  : 'Your role can review assigned attention items in view-only mode.'}
              </p>
            </div>
          </aside>
        </header>

        {(error || notice) && (
          <div
            className={`pwc-attention14-message${error ? ' is-error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <section className="pwc-attention14-metrics" aria-label="Attention queue summary">
          <article className={metrics.overdue ? 'is-danger' : ''}>
            <span>Overdue</span>
            <strong>{metrics.overdue || 0}</strong>
            <p>Past the protected due date</p>
          </article>
          <article className={metrics.dueToday ? 'is-warning' : ''}>
            <span>Due today</span>
            <strong>{metrics.dueToday || 0}</strong>
            <p>Needs movement before day end</p>
          </article>
          <article className={metrics.urgent ? 'is-priority' : ''}>
            <span>Urgent</span>
            <strong>{metrics.urgent || 0}</strong>
            <p>Highest-priority active items</p>
          </article>
          <article>
            <span>Unassigned</span>
            <strong>{metrics.unassigned || 0}</strong>
            <p>Waiting for a clear owner</p>
          </article>
          <article>
            <span>Total active</span>
            <strong>{metrics.total || 0}</strong>
            <p>Visible to this account</p>
          </article>
        </section>

        <section className="pwc-attention14-workspace" aria-labelledby="pwc-attention14-title">
          <div className="pwc-attention14-heading">
            <div>
              <p className="admin-eyebrow">Operational follow-through</p>
              <h2 id="pwc-attention14-title">Active attention</h2>
              <p>{filteredTasks.length} item{filteredTasks.length === 1 ? '' : 's'} match this view.</p>
            </div>
            <button
              type="button"
              onClick={() => loadQueue({ quiet: true })}
              disabled={loading || refreshing || saving}
            >
              {refreshing ? 'Refreshing…' : 'Refresh queue'}
            </button>
          </div>

          <div className="pwc-attention14-controls">
            <label className="pwc-attention14-search">
              <span>Search attention</span>
              <input
                type="search"
                value={query}
                placeholder="Search client, task, owner, or details…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <label>
              <span>Source</span>
              <select value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="all">All sources</option>
                <option value="lead_follow_up">Lead follow-ups</option>
                <option value="care_action">Client care actions</option>
              </select>
            </label>

            <label>
              <span>Ownership</span>
              <select value={ownership} onChange={(event) => setOwnership(event.target.value)}>
                <option value="all">All ownership</option>
                <option value="mine">Assigned to me</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>

            <label>
              <span>Timing</span>
              <select value={timing} onChange={(event) => setTiming(event.target.value)}>
                {timingDefinitions.map((definition) => (
                  <option value={definition.key} key={definition.key}>{definition.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="all">All priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>

            <button className="is-subtle" type="button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>

          {loading ? (
            <div className="pwc-attention14-loading" aria-label="Loading Studio attention queue">
              <span />
              <span />
              <span />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="pwc-attention14-empty">
              <span aria-hidden="true">✓</span>
              <h3>No active attention matches this view.</h3>
              <p>Adjust the filters, or enjoy the clarity while the queue is caught up.</p>
              <button type="button" onClick={resetFilters}>Show all attention</button>
            </div>
          ) : (
            <div className="pwc-attention14-layout">
              <div className="pwc-attention14-groups" aria-live="polite">
                {groupedTasks.map(([bucket, label, items]) => (
                  <section className={`pwc-attention14-group is-${bucket}`} key={bucket}>
                    <div className="pwc-attention14-group-heading">
                      <h3>{label}</h3>
                      <span>{items.length}</span>
                    </div>

                    <div className="pwc-attention14-list">
                      {items.map((task) => {
                        const selected = taskKey(task) === selectedKey

                        return (
                          <article
                            className={`pwc-attention14-item is-${task.priority}${selected ? ' is-selected' : ''}`}
                            key={taskKey(task)}
                          >
                            <button
                              className="pwc-attention14-item-main"
                              type="button"
                              aria-pressed={selected}
                              onClick={() => selectTask(task)}
                            >
                              <span className="pwc-attention14-item-topline">
                                <em>{task.sourceLabel}</em>
                                <strong>{priorityLabel(task.priority)}</strong>
                                <small className={`is-${timingBucket(task)}`}>{timingLabel(task)}</small>
                              </span>
                              <span className="pwc-attention14-item-copy">
                                <strong>{task.title}</strong>
                                <span>{task.clientName}</span>
                                {task.description && <small>{task.description}</small>}
                              </span>
                              <span className="pwc-attention14-item-meta">
                                <span>{task.ownerName || 'Unassigned'}</span>
                                <time dateTime={task.dueAt || undefined}>{formatDate(task.dueAt)}</time>
                              </span>
                            </button>

                            {canManage && (
                              <button
                                className="pwc-attention14-complete"
                                type="button"
                                disabled={saving}
                                onClick={() => completeTask(task)}
                              >
                                Complete
                              </button>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <aside className="pwc-attention14-editor" aria-label="Selected attention item">
                {selectedTask && draft ? (
                  <>
                    <div className="pwc-attention14-editor-heading">
                      <div>
                        <p className="admin-eyebrow">Selected item</p>
                        <h3>{selectedTask.title}</h3>
                        <p>{selectedTask.clientName}</p>
                      </div>
                      <span className={`is-${selectedTask.priority}`}>
                        {priorityLabel(selectedTask.priority)}
                      </span>
                    </div>

                    <dl className="pwc-attention14-context">
                      <div>
                        <dt>Source</dt>
                        <dd>{selectedTask.sourceLabel}</dd>
                      </div>
                      <div>
                        <dt>Current timing</dt>
                        <dd>{timingLabel(selectedTask)} · {formatDate(selectedTask.dueAt, true)}</dd>
                      </div>
                      <div>
                        <dt>Client contact</dt>
                        <dd>{selectedTask.clientEmail || 'No email recorded'}</dd>
                      </div>
                    </dl>

                    {selectedTask.description && (
                      <div className="pwc-attention14-description">
                        <span>Task context</span>
                        <p>{selectedTask.description}</p>
                      </div>
                    )}

                    <div className="pwc-attention14-form" aria-disabled={!canManage}>
                      <label>
                        <span>Owner</span>
                        <select
                          value={draft.assigneeUserId}
                          disabled={!canManage || saving}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            assigneeUserId: event.target.value,
                          }))}
                        >
                          <option value="">Unassigned</option>
                          {eligibleOwners.map((user) => (
                            <option value={user.id} key={user.id}>
                              {user.displayName} · {user.role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Due date</span>
                        <input
                          type="date"
                          value={draft.dueAt}
                          disabled={!canManage || saving}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            dueAt: event.target.value,
                          }))}
                        />
                      </label>

                      <label>
                        <span>Priority</span>
                        <select
                          value={draft.priority}
                          disabled={!canManage || saving}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            priority: event.target.value,
                          }))}
                        >
                          {selectedTask.sourceType === 'lead_follow_up' && <option value="low">Low</option>}
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>

                      <label>
                        <span>Status</span>
                        <select
                          value={draft.status}
                          disabled={!canManage || saving}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            status: event.target.value,
                          }))}
                        >
                          <option value="open">Open</option>
                          {selectedTask.sourceType === 'care_action' && (
                            <option value="in_progress">In progress</option>
                          )}
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                    </div>

                    {!canManage && (
                      <p className="pwc-attention14-view-note">
                        Your Studio role has view-only access to Client Care.
                      </p>
                    )}

                    <div className="pwc-attention14-editor-actions">
                      <button
                        type="button"
                        onClick={() => navigate(selectedTask.actionUrl)}
                      >
                        Open client context
                      </button>
                      {canManage && (
                        <>
                          <button
                            className="is-primary"
                            type="button"
                            disabled={saving || !draftChanged}
                            onClick={() => saveTask()}
                          >
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            disabled={saving}
                            onClick={cancelTask}
                          >
                            Cancel item
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="pwc-attention14-editor-empty">
                    <span aria-hidden="true">→</span>
                    <h3>Select an attention item.</h3>
                    <p>Review ownership, due date, priority, and client context here.</p>
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>
      </div>
    </AdminFrame>
  )
}
