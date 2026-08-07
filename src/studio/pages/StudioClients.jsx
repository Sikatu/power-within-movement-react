import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminClient360,
  getAdminClients,
} from '../../lib/nativeApi'

const relationshipViews = [
  ['current', 'Current clients'],
  ['onboarding', 'Onboarding'],
  ['members', 'Members'],
  ['archived', 'Archived'],
  ['all', 'All clients'],
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
  const [renderNow] = useState(() => Date.now())

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
      setDetailError('')
      return
    }

    setDetailLoading(true)
    setDetailError('')

    try {
      const response = await getAdminClient360(clientId)
      setSnapshot(response.snapshot || null)
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

      <aside className="studio-clients-readonly-note">
        <strong>Real client data connected</strong>
        <span>
          This first Clients pass is intentionally read-only. Care-plan
          and next-action editing arrive after the real records and
          relationship layout are verified.
        </span>
      </aside>

      {error && (
        <div className="studio-clients-alert is-error" role="alert">
          {error}
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
                          <p className="studio-v2-eyebrow">
                            Current care
                          </p>
                          <h3>
                            {titleCase(plan.journeyStage || 'onboarding')}
                          </h3>
                        </div>

                        <span className={`is-${plan.careStatus || 'not_started'}`}>
                          {titleCase(plan.careStatus || 'not started')}
                        </span>
                      </header>

                      <dl>
                        <div>
                          <dt>Primary goal</dt>
                          <dd>
                            {plan.primaryGoal
                              || 'No primary goal recorded yet.'}
                          </dd>
                        </div>

                        <div>
                          <dt>Transformation focus</dt>
                          <dd>
                            {plan.transformationFocus
                              || 'No transformation focus recorded yet.'}
                          </dd>
                        </div>

                        <div>
                          <dt>Client-visible focus</dt>
                          <dd>
                            {plan.clientVisibleFocus
                              || 'No client-visible focus recorded yet.'}
                          </dd>
                        </div>

                        <div>
                          <dt>Next review</dt>
                          <dd>{formatDate(plan.nextReviewAt, true)}</dd>
                        </div>
                      </dl>
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
                <section className="studio-client-records">
                  <header>
                    <div>
                      <p className="studio-v2-eyebrow">
                        Follow-through
                      </p>
                      <h3>Next best actions</h3>
                    </div>

                    <span>
                      Read-only during this verification pass
                    </span>
                  </header>

                  <div>
                    {(snapshot.actions || []).map((action) => (
                      <article
                        className={`is-${action.priority || 'normal'}`}
                        key={action.id}
                      >
                        <div className="studio-client-record-topline">
                          <span>
                            {titleCase(action.status || 'open')}
                          </span>
                          <small>
                            {titleCase(action.priority || 'normal')}
                          </small>
                        </div>

                        <h4>{action.title}</h4>

                        {action.description && (
                          <p>{action.description}</p>
                        )}

                        <dl>
                          <div>
                            <dt>Owner</dt>
                            <dd>{action.ownerName || 'Unassigned'}</dd>
                          </div>

                          <div>
                            <dt>Due</dt>
                            <dd>{formatDate(action.dueAt, true)}</dd>
                          </div>

                          <div>
                            <dt>Visibility</dt>
                            <dd>{titleCase(action.visibility || 'team')}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}

                    {!snapshot.actions?.length && (
                      <div className="studio-clients-empty">
                        No care actions have been recorded yet.
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
    </div>
  )
}