import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  createAdminClientCareAction,
  getAdminClient360,
  getAdminClients,
  getMyTeamAccess,
  updateAdminClientCareAction,
  updateAdminClientCarePlan,
} from '../../lib/nativeApi'

const relationshipViews = [
  ['current', 'Current clients'],
  ['onboarding', 'Onboarding'],
  ['members', 'Members'],
  ['archived', 'Archived'],
  ['all', 'All clients'],
]

const emptyCarePlan = {
  journeyStage: 'onboarding',
  careStatus: 'not_started',
  primaryGoal: '',
  transformationFocus: '',
  successDefinition: '',
  clientVisibleFocus: '',
  privateStrategyNotes: '',
  nextReviewAt: '',
}

const emptyCareAction = {
  title: '',
  description: '',
  ownerUserId: '',
  dueAt: '',
  priority: 'normal',
  visibility: 'team',
}

const journeyStageOptions = [
  ['onboarding', 'Onboarding'],
  ['clarity', 'Clarity'],
  ['active_work', 'Active work'],
  ['integration', 'Integration'],
  ['maintenance', 'Maintenance'],
  ['complete', 'Complete'],
]

const careStatusOptions = [
  ['not_started', 'Not started'],
  ['on_track', 'On track'],
  ['attention', 'Needs attention'],
  ['paused', 'Paused'],
  ['completed', 'Completed'],
]

const carePriorityOptions = [
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
]

function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeStatus(value) {
  const status = String(value || 'lead')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')

  if (status === 'active') return 'active_client'
  return status || 'lead'
}

function extractEmailFromNotes(notes) {
  const match = String(notes || '').match(
    /(?:^|\n)Email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  )

  return match?.[1]?.trim() || ''
}

function normalizeClient(client) {
  const firstName = client.firstName || client.first_name || ''
  const lastName = client.lastName || client.last_name || ''
  const name = (
    client.name
    || [firstName, lastName].filter(Boolean).join(' ')
    || 'Unnamed client'
  )
  const privateNotes = (
    client.privateAdminNotes
    || client.private_admin_notes
    || ''
  )

  return {
    ...client,
    id: client.id || client.clientProfileId || client.client_profile_id,
    firstName,
    lastName,
    name,
    email: (
      client.email
      || client.publicContactEmail
      || client.public_contact_email
      || extractEmailFromNotes(privateNotes)
      || ''
    ),
    phone: client.phone || client.primary_phone || '',
    clientStatus: normalizeStatus(
      client.clientStatus || client.client_status,
    ),
    portalStatus: String(
      client.portalStatus
      || client.portal_status
      || client.userStatus
      || client.user_status
      || 'not_active',
    ).toLowerCase(),
    interest: (
      client.leadInterest
      || client.lead_interest
      || client.interest
      || ''
    ),
    source: client.leadSource || client.lead_source || '',
    intakeCompletedAt: (
      client.intakeCompletedAt
      || client.intake_completed_at
      || null
    ),
    createdAt: client.createdAt || client.created_at || null,
    updatedAt: client.updatedAt || client.updated_at || null,
    tags: Array.isArray(client.tags) ? client.tags : [],
  }
}

function getClientList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.clients)) return response.clients
  if (Array.isArray(response?.clientProfiles)) {
    return response.clientProfiles
  }
  if (Array.isArray(response?.records)) return response.records
  return []
}

function isClientRecord(client) {
  return client.clientStatus !== 'lead'
}

function matchesRelationshipView(client, view) {
  const status = client.clientStatus

  if (!isClientRecord(client)) return false
  if (view === 'all') return true

  if (view === 'current') {
    return ['active_client', 'member'].includes(status)
  }

  if (view === 'onboarding') {
    return (
      ['active_client', 'member'].includes(status)
      && !client.intakeCompletedAt
    )
  }

  if (view === 'members') return status === 'member'

  if (view === 'archived') {
    return ['inactive', 'archived'].includes(status)
  }

  return true
}

function clientMatchesSearch(client, query) {
  const search = query.trim().toLowerCase()
  if (!search) return true

  return [
    client.name,
    client.email,
    client.phone,
    client.interest,
    client.source,
    client.clientStatus,
    ...client.tags.map((tag) => tag.name),
  ].some((value) => (
    String(value || '').toLowerCase().includes(search)
  ))
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Not recorded'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'

  return new Intl.DateTimeFormat(
    undefined,
    includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' },
  ).format(date)
}

function toLocalDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()

  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)
}

function toIsoOrNull(value) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function planToForm(plan) {
  if (!plan) return emptyCarePlan

  return {
    journeyStage: plan.journeyStage || 'onboarding',
    careStatus: plan.careStatus || 'not_started',
    primaryGoal: plan.primaryGoal || '',
    transformationFocus: plan.transformationFocus || '',
    successDefinition: plan.successDefinition || '',
    clientVisibleFocus: plan.clientVisibleFocus || '',
    privateStrategyNotes: plan.privateStrategyNotes || '',
    nextReviewAt: toLocalDateTimeInput(plan.nextReviewAt),
  }
}

function actionToForm(action) {
  if (!action) return emptyCareAction

  return {
    title: action.title || '',
    description: action.description || '',
    ownerUserId: action.ownerUserId || '',
    dueAt: toLocalDateTimeInput(action.dueAt),
    priority: action.priority || 'normal',
    visibility: action.visibility || 'team',
  }
}

function formatPortalStatus(value) {
  const status = String(value || '').toLowerCase()

  if (status === 'active') return 'Active'
  if (status === 'accepted') return 'Active'
  if (status === 'invited') return 'Invited'
  if (status === 'pending') return 'Pending'
  if (status === 'inactive') return 'Inactive'
  return 'Not active'
}

function initials(client) {
  return [
    client.firstName?.[0],
    client.lastName?.[0],
  ].filter(Boolean).join('').toUpperCase() || 'C'
}

function ClientCard({
  client,
  selected,
  onSelect,
}) {
  return (
    <button
      aria-pressed={selected}
      className={`studio-client-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(client.id)}
      type="button"
    >
      <span className="studio-client-card-avatar" aria-hidden="true">
        {initials(client)}
      </span>

      <span className="studio-client-card-copy">
        <span className="studio-client-card-topline">
          <strong>{client.name}</strong>
          <small className={`is-${client.clientStatus}`}>
            {titleCase(client.clientStatus)}
          </small>
        </span>

        <span>{client.email || 'No email saved'}</span>

        <span className="studio-client-card-meta">
          <span>
            {client.interest || 'Relationship profile'}
          </span>
          <span>
            {client.intakeCompletedAt ? 'Intake complete' : 'Intake pending'}
          </span>
        </span>
      </span>
    </button>
  )
}

export default function StudioClients() {
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const [relationshipView, setRelationshipView] = useState('current')
  const [detailView, setDetailView] = useState('overview')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [planForm, setPlanForm] = useState(emptyCarePlan)
  const [actionForm, setActionForm] = useState(emptyCareAction)
  const [actionEditForm, setActionEditForm] = useState(emptyCareAction)
  const [teamAccess, setTeamAccess] = useState(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editingActionId, setEditingActionId] = useState('')
  const [isActionComposerOpen, setIsActionComposerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [renderNow] = useState(() => Date.now())

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(
        window.sessionStorage.getItem('pwc_admin_user') || 'null',
      )
    } catch {
      return null
    }
  }, [])

  const canManage = (
    adminUser?.role !== 'staff'
    || teamAccess?.permissions?.clients === 'manage'
  )

  const loadClients = useCallback(async ({
    preserveSelection = true,
  } = {}) => {
    setLoading(true)
    setError('')

    try {
      const response = await getAdminClients()
      const nextClients = getClientList(response).map(normalizeClient)
      const clientRecords = nextClients.filter(isClientRecord)

      setClients(nextClients)

      const canKeepSelection = (
        preserveSelection
        && clientRecords.some(
          (client) => client.id === selectedClientId,
        )
      )

      const nextClientId = canKeepSelection
        ? selectedClientId
        : (
          clientRecords.find((client) => (
            ['active_client', 'member'].includes(client.clientStatus)
          ))?.id
          || clientRecords[0]?.id
          || ''
        )

      setSelectedClientId(nextClientId)
    } catch (loadError) {
      setError(
        loadError.message
        || 'Unable to load client relationships.',
      )
    } finally {
      setLoading(false)
    }
  }, [selectedClientId])

  const loadSnapshot = useCallback(async (clientId) => {
    if (!clientId) {
      setSnapshot(null)
      setPlanForm(emptyCarePlan)
      setActionForm(emptyCareAction)
      setActionEditForm(emptyCareAction)
      setEditingPlan(false)
      setEditingActionId('')
      setIsActionComposerOpen(false)
      setDetailError('')
      return
    }

    setDetailLoading(true)
    setDetailError('')

    try {
      const response = await getAdminClient360(clientId)
      const nextSnapshot = response.snapshot || null

      setSnapshot(nextSnapshot)
      setPlanForm(planToForm(nextSnapshot?.plan))
      setActionForm(emptyCareAction)
      setActionEditForm(emptyCareAction)
      setEditingPlan(false)
      setEditingActionId('')
      setIsActionComposerOpen(false)
    } catch (loadError) {
      setSnapshot(null)
      setDetailError(
        loadError.message
        || 'Unable to load this complete client workspace.',
      )
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadClients({ preserveSelection: false })
    }, 0)

    return () => window.clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSnapshot(selectedClientId)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadSnapshot, selectedClientId])

  useEffect(() => {
    if (adminUser?.role !== 'staff') return undefined

    let active = true

    getMyTeamAccess()
      .then((response) => {
        if (active) {
          setTeamAccess(response.access || { permissions: {} })
        }
      })
      .catch(() => {
        if (active) setTeamAccess({ permissions: {} })
      })

    return () => {
      active = false
    }
  }, [adminUser?.role])

  useEffect(() => {
    if (!pendingAction) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) {
        setPendingAction(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [pendingAction, saving])

  const clientRecords = useMemo(
    () => clients.filter(isClientRecord),
    [clients],
  )

  const filteredClients = useMemo(
    () => clientRecords.filter((client) => (
      matchesRelationshipView(client, relationshipView)
      && clientMatchesSearch(client, search)
    )),
    [clientRecords, relationshipView, search],
  )

  const metrics = useMemo(() => ({
    current: clientRecords.filter((client) => (
      ['active_client', 'member'].includes(client.clientStatus)
    )).length,
    onboarding: clientRecords.filter((client) => (
      ['active_client', 'member'].includes(client.clientStatus)
      && !client.intakeCompletedAt
    )).length,
    members: clientRecords.filter(
      (client) => client.clientStatus === 'member',
    ).length,
    archived: clientRecords.filter((client) => (
      ['inactive', 'archived'].includes(client.clientStatus)
    )).length,
  }), [clientRecords])

  const selectedDirectoryClient = useMemo(
    () => clients.find(
      (client) => client.id === selectedClientId,
    ) || null,
    [clients, selectedClientId],
  )

  const summary = snapshot?.summary || {}
  const plan = snapshot?.plan || {}
  const snapshotClient = snapshot?.client || null

  const nextSession = useMemo(
    () => [...(snapshot?.bookings || [])]
      .filter((booking) => (
        ['requested', 'approved', 'confirmed'].includes(booking.status)
      ))
      .filter((booking) => (
        new Date(booking.starts_at).getTime() >= renderNow
      ))
      .sort(
        (left, right) => (
          new Date(left.starts_at) - new Date(right.starts_at)
        ),
      )[0] || null,
    [renderNow, snapshot?.bookings],
  )

  function selectClient(clientId) {
    setSelectedClientId(clientId)
    setDetailView('overview')
    setNotice('')
    setError('')
    setPendingAction(null)
    setEditingPlan(false)
    setEditingActionId('')
    setIsActionComposerOpen(false)
  }

  function syncSnapshotResult(result, fallbackMessage) {
    const nextSnapshot = result.snapshot || snapshot

    setSnapshot(nextSnapshot)
    setPlanForm(planToForm(nextSnapshot?.plan))
    setNotice(result.message || fallbackMessage)
  }

  async function handlePlanSave(event) {
    event.preventDefault()
    if (!selectedClientId || !canManage) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminClientCarePlan(
        selectedClientId,
        {
          journeyStage: planForm.journeyStage,
          careStatus: planForm.careStatus,
          primaryGoal: planForm.primaryGoal.trim(),
          transformationFocus: planForm.transformationFocus.trim(),
          successDefinition: planForm.successDefinition.trim(),
          clientVisibleFocus: planForm.clientVisibleFocus.trim(),
          privateStrategyNotes: planForm.privateStrategyNotes.trim(),
          nextReviewAt: toIsoOrNull(planForm.nextReviewAt),
        },
      )

      syncSnapshotResult(result, 'Client care plan saved.')
      setEditingPlan(false)
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to save the client care plan.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleActionCreate(event) {
    event.preventDefault()
    if (!selectedClientId || !canManage) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await createAdminClientCareAction(
        selectedClientId,
        {
          title: actionForm.title.trim(),
          description: actionForm.description.trim(),
          ownerUserId: actionForm.ownerUserId || null,
          dueAt: toIsoOrNull(actionForm.dueAt),
          priority: actionForm.priority,
          status: 'open',
          visibility: actionForm.visibility,
        },
      )

      syncSnapshotResult(result, 'Care action created.')
      setActionForm(emptyCareAction)
      setIsActionComposerOpen(false)
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to create the care action.',
      )
    } finally {
      setSaving(false)
    }
  }

  function beginActionEdit(action) {
    setEditingActionId(action.id)
    setActionEditForm(actionToForm(action))
    setError('')
    setNotice('')
  }

  function cancelActionEdit() {
    setEditingActionId('')
    setActionEditForm(emptyCareAction)
  }

  async function handleActionEditSave(event, action) {
    event.preventDefault()
    if (!selectedClientId || !canManage) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminClientCareAction(
        selectedClientId,
        action.id,
        {
          title: actionEditForm.title.trim(),
          description: actionEditForm.description.trim(),
          ownerUserId: actionEditForm.ownerUserId || null,
          dueAt: toIsoOrNull(actionEditForm.dueAt),
          priority: actionEditForm.priority,
          visibility: actionEditForm.visibility,
        },
      )

      syncSnapshotResult(result, 'Care action updated.')
      cancelActionEdit()
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to update the care action.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function persistActionStatus(action, status) {
    if (!selectedClientId || !canManage) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminClientCareAction(
        selectedClientId,
        action.id,
        { status },
      )

      syncSnapshotResult(result, 'Care action updated.')
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to update the care action status.',
      )
    } finally {
      setSaving(false)
      setPendingAction(null)
    }
  }

  function requestActionStatus(action, status) {
    if (status !== 'cancelled') {
      persistActionStatus(action, status)
      return
    }

    setPendingAction({
      title: `Cancel "${action.title}"?`,
      message:
        'This removes the action from active follow-through while keeping it in the complete client history.',
      detail:
        'The action can be reopened later from this Clients workspace.',
      confirmLabel: 'Cancel action',
      action,
      status,
    })
  }

  function changeRelationshipView(nextView) {
    setRelationshipView(nextView)

    const nextCandidate = clients.find((client) => (
      matchesRelationshipView(client, nextView)
      && clientMatchesSearch(client, search)
    ))

    if (
      nextCandidate
      && !matchesRelationshipView(
        selectedDirectoryClient || {},
        nextView,
      )
    ) {
      selectClient(nextCandidate.id)
    }
  }

  return (
    <div className="studio-v2-page studio-clients-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">Relationships and care</p>
          <h1>Clients</h1>
          <p>
            See who is in active care, what needs attention, and the
            clearest next step for each relationship.
          </p>
        </div>

        <div className="studio-clients-header-actions">
          <button
            className="studio-v2-button is-primary"
            disabled={loading}
            onClick={() => loadClients()}
            type="button"
          >
            {loading ? 'Refreshing...' : 'Refresh Clients'}
          </button>

          <Link
            className="studio-v2-button is-secondary"
            to="/admin/clients"
          >
            Legacy Clients
          </Link>
        </div>
      </header>

      <aside className="studio-clients-actions-note">
        <strong>
          {canManage
            ? 'Protected client-care actions enabled'
            : 'Client care is view-only'}
        </strong>
        <span>
          {canManage
            ? 'Care plans, next actions, ownership, due dates, and status updates now use the existing secured Client 360 APIs.'
            : 'Your current team permission allows relationship review, but client-care changes remain locked.'}
        </span>
      </aside>

      {error && (
        <div className="studio-clients-alert is-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="studio-clients-alert is-success" role="status">
          {notice}
        </div>
      )}

      <section
        aria-label="Client relationship summary"
        className="studio-clients-metrics"
      >
        <article>
          <span>Current clients</span>
          <strong>{metrics.current}</strong>
        </article>

        <article>
          <span>Intake pending</span>
          <strong>{metrics.onboarding}</strong>
        </article>

        <article>
          <span>Members</span>
          <strong>{metrics.members}</strong>
        </article>

        <article>
          <span>Archived</span>
          <strong>{metrics.archived}</strong>
        </article>
      </section>

      <section className="studio-clients-toolbar">
        <label>
          <span>Search clients</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, service interest, phone, or tag"
            type="search"
            value={search}
          />
        </label>

        <p>
          Lead records remain in the dedicated Pipeline workspace.
        </p>
      </section>

      <nav
        aria-label="Client relationship view"
        className="studio-clients-view-switcher"
      >
        {relationshipViews.map(([value, label]) => (
          <button
            aria-pressed={relationshipView === value}
            className={relationshipView === value ? 'is-active' : ''}
            key={value}
            onClick={() => changeRelationshipView(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="studio-clients-layout">
        <section
          aria-label="Client directory"
          className="studio-clients-directory"
        >
          <header>
            <div>
              <p className="studio-v2-eyebrow">Relationship directory</p>
              <h2>{filteredClients.length} shown</h2>
            </div>

            <span>{clientRecords.length} total</span>
          </header>

          <div className="studio-clients-directory-list">
            {loading && !clients.length ? (
              <div className="studio-clients-empty">
                Loading client relationships...
              </div>
            ) : filteredClients.map((client) => (
              <ClientCard
                client={client}
                key={client.id}
                onSelect={selectClient}
                selected={client.id === selectedClientId}
              />
            ))}

            {!loading && filteredClients.length === 0 && (
              <div className="studio-clients-empty">
                <strong>No clients match this view.</strong>
                <span>
                  Adjust the relationship view or search. New inquiries
                  remain available in Pipeline.
                </span>
                <Link to="/studio/pipeline">Open Pipeline</Link>
              </div>
            )}
          </div>
        </section>

        <section
          aria-label="Selected client relationship"
          className="studio-client-detail"
        >
          {detailLoading ? (
            <div className="studio-clients-empty is-detail">
              Opening the complete client relationship...
            </div>
          ) : detailError ? (
            <div className="studio-clients-empty is-detail">
              <strong>Client workspace unavailable</strong>
              <span>{detailError}</span>
              {selectedDirectoryClient && (
                <Link
                  to={`/admin/clients/${selectedDirectoryClient.id}/overview`}
                >
                  Open Legacy profile
                </Link>
              )}
            </div>
          ) : !snapshot || !selectedDirectoryClient ? (
            <div className="studio-clients-empty is-detail">
              <strong>Select a client relationship</strong>
              <span>
                Choose a client to see care status, next actions,
                sessions, activity, and assigned team.
              </span>
            </div>
          ) : (
            <>
              <header className="studio-client-detail-header">
                <div className="studio-client-detail-identity">
                  <span aria-hidden="true">
                    {initials(selectedDirectoryClient)}
                  </span>

                  <div>
                    <p className="studio-v2-eyebrow">
                      {titleCase(selectedDirectoryClient.clientStatus)}
                    </p>
                    <h2>
                      {snapshotClient?.name
                        || selectedDirectoryClient.name}
                    </h2>
                    <p>
                      {snapshotClient?.email
                        || selectedDirectoryClient.email
                        || 'No email saved'}
                    </p>
                  </div>
                </div>

                <div className="studio-client-detail-actions">
                  <Link
                    className="studio-v2-button is-primary"
                    to={`/admin/client-360/${selectedDirectoryClient.id}`}
                  >
                    Open Client 360
                  </Link>

                  <Link
                    className="studio-v2-button is-secondary"
                    to={`/admin/clients/${selectedDirectoryClient.id}/overview`}
                  >
                    Legacy profile
                  </Link>
                </div>
              </header>

              <nav
                aria-label="Client relationship sections"
                className="studio-client-detail-tabs"
              >
                {[
                  ['overview', 'Overview'],
                  ['actions', 'Next actions'],
                  ['journey', 'Journey'],
                ].map(([value, label]) => (
                  <button
                    aria-selected={detailView === value}
                    className={detailView === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setDetailView(value)}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {detailView === 'overview' && (
                <div className="studio-client-overview">
                  <section
                    aria-label="Client care pulse"
                    className="studio-client-pulse"
                  >
                    <article className={
                      summary.overdueActions ? 'needs-attention' : ''
                    }>
                      <span>Open actions</span>
                      <strong>{summary.openActions || 0}</strong>
                      <small>
                        {summary.overdueActions || 0} overdue
                      </small>
                    </article>

                    <article>
                      <span>Upcoming sessions</span>
                      <strong>{summary.upcomingSessions || 0}</strong>
                      <small>
                        {nextSession
                          ? formatDate(nextSession.starts_at, true)
                          : 'Nothing scheduled'}
                      </small>
                    </article>

                    <article className={
                      summary.unreadMessages ? 'needs-attention' : ''
                    }>
                      <span>Open inbox</span>
                      <strong>{summary.openConversations || 0}</strong>
                      <small>
                        {summary.unreadMessages || 0} unread
                      </small>
                    </article>

                    <article>
                      <span>Programs</span>
                      <strong>
                        {(summary.activeCourses || 0)
                          + (summary.activeMemberships || 0)}
                      </strong>
                      <small>
                        {summary.activeCourses || 0} learning,
                        {' '}
                        {summary.activeMemberships || 0} membership
                      </small>
                    </article>
                  </section>

                  <div className="studio-client-overview-grid">
                    <article className="studio-client-care-card">
                      <header>
                        <div>
                          <p className="studio-v2-eyebrow">Current care</p>
                          <h3>{titleCase(plan.journeyStage || 'onboarding')}</h3>
                        </div>

                        <div className="studio-client-care-heading-actions">
                          <span className={`is-${plan.careStatus || 'not_started'}`}>
                            {titleCase(plan.careStatus || 'not started')}
                          </span>

                          {canManage && !editingPlan && (
                            <button
                              className="studio-client-text-button"
                              onClick={() => {
                                setPlanForm(planToForm(plan))
                                setEditingPlan(true)
                                setError('')
                                setNotice('')
                              }}
                              type="button"
                            >
                              Edit care plan
                            </button>
                          )}
                        </div>
                      </header>

                      {editingPlan ? (
                        <form className="studio-client-care-form" onSubmit={handlePlanSave}>
                          <div className="studio-client-care-form-grid">
                            <label>
                              <span>Journey stage</span>
                              <select
                                onChange={(event) => setPlanForm((current) => ({
                                  ...current,
                                  journeyStage: event.target.value,
                                }))}
                                value={planForm.journeyStage}
                              >
                                {journeyStageOptions.map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span>Care status</span>
                              <select
                                onChange={(event) => setPlanForm((current) => ({
                                  ...current,
                                  careStatus: event.target.value,
                                }))}
                                value={planForm.careStatus}
                              >
                                {careStatusOptions.map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span>Next review</span>
                              <input
                                onChange={(event) => setPlanForm((current) => ({
                                  ...current,
                                  nextReviewAt: event.target.value,
                                }))}
                                type="datetime-local"
                                value={planForm.nextReviewAt}
                              />
                            </label>
                          </div>

                          {[
                            ['primaryGoal', 'Primary goal', 'The most important transformation outcome right now', 2000, 3],
                            ['transformationFocus', 'Transformation focus', 'Confidence, presence, image, style, routines, communication, or another focus', 4000, 3],
                            ['successDefinition', 'Success definition', 'How the team will recognize meaningful progress', 4000, 3],
                            ['clientVisibleFocus', 'Client-visible focus', 'A supportive focus statement suitable for the Client Portal', 4000, 3],
                            ['privateStrategyNotes', 'Private strategy notes', 'Internal care strategy and coordination context', 10000, 4],
                          ].map(([field, label, placeholder, maxLength, rows]) => (
                            <label
                              className={field === 'privateStrategyNotes' ? 'is-private' : ''}
                              key={field}
                            >
                              <span>{label}</span>
                              <textarea
                                maxLength={maxLength}
                                onChange={(event) => setPlanForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))}
                                placeholder={placeholder}
                                rows={rows}
                                value={planForm[field]}
                              />
                            </label>
                          ))}

                          <div className="studio-client-form-actions">
                            <span>Private strategy notes never appear in the Client Portal.</span>
                            <div>
                              <button
                                className="studio-v2-button is-secondary"
                                disabled={saving}
                                onClick={() => {
                                  setPlanForm(planToForm(plan))
                                  setEditingPlan(false)
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="studio-v2-button is-primary"
                                disabled={saving}
                                type="submit"
                              >
                                {saving ? 'Saving...' : 'Save care plan'}
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <dl>
                          <div><dt>Primary goal</dt><dd>{plan.primaryGoal || 'No primary goal recorded yet.'}</dd></div>
                          <div><dt>Transformation focus</dt><dd>{plan.transformationFocus || 'No transformation focus recorded yet.'}</dd></div>
                          <div><dt>Success definition</dt><dd>{plan.successDefinition || 'No success definition recorded yet.'}</dd></div>
                          <div><dt>Client-visible focus</dt><dd>{plan.clientVisibleFocus || 'No client-visible focus recorded yet.'}</dd></div>
                          <div><dt>Next review</dt><dd>{formatDate(plan.nextReviewAt, true)}</dd></div>
                        </dl>
                      )}
                    </article>

                    <aside className="studio-client-facts">
                      <div>
                        <span>Portal</span>
                        <strong>
                          {formatPortalStatus(
                            snapshotClient?.portalStatus
                            || selectedDirectoryClient.portalStatus,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Intake</span>
                        <strong>
                          {selectedDirectoryClient.intakeCompletedAt
                            ? 'Complete'
                            : 'Pending'}
                        </strong>
                      </div>

                      <div>
                        <span>Service interest</span>
                        <strong>
                          {selectedDirectoryClient.interest
                            || 'Not recorded'}
                        </strong>
                      </div>

                      <div>
                        <span>Phone</span>
                        <strong>
                          {snapshotClient?.phone
                            || selectedDirectoryClient.phone
                            || 'Not recorded'}
                        </strong>
                      </div>

                      <div>
                        <span>Relationship since</span>
                        <strong>
                          {formatDate(selectedDirectoryClient.createdAt)}
                        </strong>
                      </div>
                    </aside>
                  </div>

                  <section className="studio-client-team-session">
                    <article>
                      <p className="studio-v2-eyebrow">Next session</p>
                      <h3>
                        {nextSession?.appointment_type_name
                          || 'Not scheduled'}
                      </h3>

                      {nextSession ? (
                        <>
                          <strong>
                            {formatDate(nextSession.starts_at, true)}
                          </strong>
                          <span>
                            {titleCase(nextSession.status)}
                            {nextSession.timezone
                              ? ` | ${nextSession.timezone}`
                              : ''}
                          </span>
                        </>
                      ) : (
                        <span>
                          No requested, approved, or confirmed session is
                          currently connected.
                        </span>
                      )}
                    </article>

                    <article>
                      <p className="studio-v2-eyebrow">Care team</p>
                      <h3>
                        {(snapshot.team || []).length
                          ? `${snapshot.team.length} assigned`
                          : 'No team assigned'}
                      </h3>

                      <div className="studio-client-team-list">
                        {(snapshot.team || []).slice(0, 4).map(
                          (member) => (
                            <span key={member.userId}>
                              <strong>{member.displayName}</strong>
                              <small>
                                {titleCase(
                                  member.assignmentRole
                                  || member.role,
                                )}
                              </small>
                            </span>
                          ),
                        )}

                        {!snapshot.team?.length && (
                          <span>
                            Assignments remain available in Legacy Studio.
                          </span>
                        )}
                      </div>
                    </article>
                  </section>
                </div>
              )}

              {detailView === 'actions' && (
                <section className="studio-client-records studio-client-actions-workspace">
                  <header>
                    <div>
                      <p className="studio-v2-eyebrow">Follow-through</p>
                      <h3>Next best actions</h3>
                    </div>

                    {canManage ? (
                      <button
                        className="studio-v2-button is-primary"
                        disabled={saving}
                        onClick={() => {
                          setIsActionComposerOpen((current) => !current)
                          setActionForm(emptyCareAction)
                          setEditingActionId('')
                          setError('')
                          setNotice('')
                        }}
                        type="button"
                      >
                        {isActionComposerOpen ? 'Close action form' : 'Add next action'}
                      </button>
                    ) : (
                      <span>View-only for your current permission level</span>
                    )}
                  </header>

                  {isActionComposerOpen && canManage && (
                    <form className="studio-client-action-form" onSubmit={handleActionCreate}>
                      <div className="studio-client-action-form-heading">
                        <div>
                          <p className="studio-v2-eyebrow">Create action</p>
                          <h4>Make the next step clear</h4>
                        </div>
                        <span>Ownership and due dates keep care moving.</span>
                      </div>

                      <label className="is-wide">
                        <span>Action title</span>
                        <input
                          maxLength="240"
                          onChange={(event) => setActionForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))}
                          placeholder="Prepare the personal color summary"
                          required
                          value={actionForm.title}
                        />
                      </label>

                      <label className="is-wide">
                        <span>Description</span>
                        <textarea
                          maxLength="4000"
                          onChange={(event) => setActionForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))}
                          placeholder="Add enough context for the assigned team member"
                          rows="3"
                          value={actionForm.description}
                        />
                      </label>

                      <div className="studio-client-action-form-grid">
                        <label>
                          <span>Owner</span>
                          <select
                            onChange={(event) => setActionForm((current) => ({
                              ...current,
                              ownerUserId: event.target.value,
                            }))}
                            value={actionForm.ownerUserId}
                          >
                            <option value="">Unassigned</option>
                            {(snapshot.team || []).map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.displayName} | {titleCase(member.assignmentRole || member.role)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Due</span>
                          <input
                            onChange={(event) => setActionForm((current) => ({
                              ...current,
                              dueAt: event.target.value,
                            }))}
                            type="datetime-local"
                            value={actionForm.dueAt}
                          />
                        </label>

                        <label>
                          <span>Priority</span>
                          <select
                            onChange={(event) => setActionForm((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))}
                            value={actionForm.priority}
                          >
                            {carePriorityOptions.map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Visibility</span>
                          <select
                            onChange={(event) => setActionForm((current) => ({
                              ...current,
                              visibility: event.target.value,
                            }))}
                            value={actionForm.visibility}
                          >
                            <option value="team">Team only</option>
                            <option value="client">Client visible</option>
                          </select>
                        </label>
                      </div>

                      <div className="studio-client-form-actions">
                        <span>Owners must already be assigned to this client.</span>
                        <div>
                          <button
                            className="studio-v2-button is-secondary"
                            disabled={saving}
                            onClick={() => {
                              setActionForm(emptyCareAction)
                              setIsActionComposerOpen(false)
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button className="studio-v2-button is-primary" disabled={saving} type="submit">
                            {saving ? 'Creating...' : 'Create action'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="studio-client-action-list">
                    {(snapshot.actions || []).map((action) => (
                      <article
                        className={`is-${action.priority || 'normal'} is-status-${action.status || 'open'}`}
                        key={action.id}
                      >
                        {editingActionId === action.id ? (
                          <form
                            className="studio-client-action-form is-inline"
                            onSubmit={(event) => handleActionEditSave(event, action)}
                          >
                            <div className="studio-client-action-form-heading">
                              <div>
                                <p className="studio-v2-eyebrow">Edit action</p>
                                <h4>{action.title}</h4>
                              </div>
                              <span>Status remains controlled separately.</span>
                            </div>

                            <label className="is-wide">
                              <span>Action title</span>
                              <input
                                maxLength="240"
                                onChange={(event) => setActionEditForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))}
                                required
                                value={actionEditForm.title}
                              />
                            </label>

                            <label className="is-wide">
                              <span>Description</span>
                              <textarea
                                maxLength="4000"
                                onChange={(event) => setActionEditForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))}
                                rows="3"
                                value={actionEditForm.description}
                              />
                            </label>

                            <div className="studio-client-action-form-grid">
                              <label>
                                <span>Owner</span>
                                <select
                                  onChange={(event) => setActionEditForm((current) => ({
                                    ...current,
                                    ownerUserId: event.target.value,
                                  }))}
                                  value={actionEditForm.ownerUserId}
                                >
                                  <option value="">Unassigned</option>
                                  {(snapshot.team || []).map((member) => (
                                    <option key={member.userId} value={member.userId}>
                                      {member.displayName} | {titleCase(member.assignmentRole || member.role)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label>
                                <span>Due</span>
                                <input
                                  onChange={(event) => setActionEditForm((current) => ({
                                    ...current,
                                    dueAt: event.target.value,
                                  }))}
                                  type="datetime-local"
                                  value={actionEditForm.dueAt}
                                />
                              </label>

                              <label>
                                <span>Priority</span>
                                <select
                                  onChange={(event) => setActionEditForm((current) => ({
                                    ...current,
                                    priority: event.target.value,
                                  }))}
                                  value={actionEditForm.priority}
                                >
                                  {carePriorityOptions.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              </label>

                              <label>
                                <span>Visibility</span>
                                <select
                                  onChange={(event) => setActionEditForm((current) => ({
                                    ...current,
                                    visibility: event.target.value,
                                  }))}
                                  value={actionEditForm.visibility}
                                >
                                  <option value="team">Team only</option>
                                  <option value="client">Client visible</option>
                                </select>
                              </label>
                            </div>

                            <div className="studio-client-form-actions">
                              <span>Only assigned team members can own an action.</span>
                              <div>
                                <button className="studio-v2-button is-secondary" disabled={saving} onClick={cancelActionEdit} type="button">
                                  Cancel
                                </button>
                                <button className="studio-v2-button is-primary" disabled={saving} type="submit">
                                  {saving ? 'Saving...' : 'Save action'}
                                </button>
                              </div>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="studio-client-record-topline">
                              <span>{titleCase(action.status || 'open')}</span>
                              <small>{titleCase(action.priority || 'normal')}</small>
                            </div>

                            <h4>{action.title}</h4>
                            {action.description && <p>{action.description}</p>}

                            <dl>
                              <div><dt>Owner</dt><dd>{action.ownerName || 'Unassigned'}</dd></div>
                              <div><dt>Due</dt><dd>{formatDate(action.dueAt, true)}</dd></div>
                              <div>
                                <dt>Visibility</dt>
                                <dd>{action.visibility === 'client' ? 'Client visible' : 'Team only'}</dd>
                              </div>
                            </dl>

                            {canManage && (
                              <div className="studio-client-action-buttons">
                                <button disabled={saving} onClick={() => beginActionEdit(action)} type="button">
                                  Edit details
                                </button>

                                {action.status === 'open' && (
                                  <button disabled={saving} onClick={() => requestActionStatus(action, 'in_progress')} type="button">
                                    Start
                                  </button>
                                )}

                                {['open', 'in_progress'].includes(action.status) && (
                                  <button disabled={saving} onClick={() => requestActionStatus(action, 'completed')} type="button">
                                    Complete
                                  </button>
                                )}

                                {['completed', 'cancelled'].includes(action.status) && (
                                  <button disabled={saving} onClick={() => requestActionStatus(action, 'open')} type="button">
                                    Reopen
                                  </button>
                                )}

                                {['open', 'in_progress'].includes(action.status) && (
                                  <button className="is-quiet" disabled={saving} onClick={() => requestActionStatus(action, 'cancelled')} type="button">
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    ))}

                    {!snapshot.actions?.length && (
                      <div className="studio-clients-empty">
                        <strong>No next actions recorded yet.</strong>
                        <span>Add the clearest next step when this relationship needs follow-through.</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {detailView === 'journey' && (
                <section className="studio-client-records">
                  <header>
                    <div>
                      <p className="studio-v2-eyebrow">
                        Relationship history
                      </p>
                      <h3>Recent journey activity</h3>
                    </div>

                    <span>
                      Sessions, services, and secure communication
                    </span>
                  </header>

                  <ol className="studio-client-journey">
                    {(snapshot.activity || []).map((activity) => (
                      <li key={activity.id}>
                        <span aria-hidden="true" />

                        <div>
                          <strong>{activity.title}</strong>
                          <p>{titleCase(activity.detail)}</p>
                          <small>
                            {formatDate(activity.occurredAt, true)}
                          </small>
                        </div>
                      </li>
                    ))}

                    {!snapshot.activity?.length && (
                      <li className="studio-clients-empty">
                        No journey activity has been recorded yet.
                      </li>
                    )}
                  </ol>
                </section>
              )}
            </>
          )}
        </section>
      </div>

      {pendingAction && (
        <div className="studio-client-dialog-scrim" role="presentation">
          <section
            aria-describedby="studio-client-dialog-description"
            aria-labelledby="studio-client-dialog-title"
            aria-modal="true"
            className="studio-client-dialog"
            role="dialog"
          >
            <p className="studio-v2-eyebrow">Confirm change</p>
            <h2 id="studio-client-dialog-title">{pendingAction.title}</h2>
            <p id="studio-client-dialog-description">{pendingAction.message}</p>
            <small>{pendingAction.detail}</small>

            <div>
              <button
                className="studio-v2-button is-secondary"
                disabled={saving}
                onClick={() => setPendingAction(null)}
                type="button"
              >
                Keep action
              </button>

              <button
                className="studio-v2-button is-primary"
                disabled={saving}
                onClick={() => persistActionStatus(
                  pendingAction.action,
                  pendingAction.status,
                )}
                type="button"
              >
                {saving ? 'Saving...' : pendingAction.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}