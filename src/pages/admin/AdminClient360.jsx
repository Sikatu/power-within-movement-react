import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createAdminClientCareAction,
  getAdminClient360,
  getMyTeamAccess,
  updateAdminClientCareAction,
  updateAdminClientCarePlan,
} from '../../lib/nativeApi'
import './Client360.css'
import './AdminOperationsElevation.css'
import './AdminClientsPhase5.css'

const emptyPlan = {
  journeyStage: 'onboarding',
  careStatus: 'not_started',
  primaryGoal: '',
  transformationFocus: '',
  successDefinition: '',
  clientVisibleFocus: '',
  privateStrategyNotes: '',
  nextReviewAt: '',
}

const emptyAction = {
  title: '',
  description: '',
  ownerUserId: '',
  dueAt: '',
  priority: 'normal',
  status: 'open',
  visibility: 'team',
}

function dateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value, options = {}) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date)
}

function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function planToForm(plan) {
  if (!plan) return emptyPlan
  return {
    journeyStage: plan.journeyStage || 'onboarding',
    careStatus: plan.careStatus || 'not_started',
    primaryGoal: plan.primaryGoal || '',
    transformationFocus: plan.transformationFocus || '',
    successDefinition: plan.successDefinition || '',
    clientVisibleFocus: plan.clientVisibleFocus || '',
    privateStrategyNotes: plan.privateStrategyNotes || '',
    nextReviewAt: dateTimeInputValue(plan.nextReviewAt),
  }
}

function AdminClient360() {
  const { clientId } = useParams()
  const [snapshot, setSnapshot] = useState(null)
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [actionForm, setActionForm] = useState(emptyAction)
  const [teamAccess, setTeamAccess] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingAction, setIsSavingAction] = useState(false)
  const [updatingActionId, setUpdatingActionId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionFilter, setActionFilter] = useState('active')
  const [renderNow] = useState(() => Date.now())

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
    } catch {
      return null
    }
  }, [])

  const canManage = adminUser?.role !== 'staff' || teamAccess?.permissions?.clients === 'manage'

  async function loadSnapshot({ quiet = false } = {}) {
    if (!quiet) setIsLoading(true)
    setError('')

    try {
      const response = await getAdminClient360(clientId)
      const nextSnapshot = response.snapshot || null
      setSnapshot(nextSnapshot)
      setPlanForm(planToForm(nextSnapshot?.plan))
    } catch (loadError) {
      setError(loadError.message || 'Client 360 could not be loaded.')
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    getAdminClient360(clientId)
      .then((response) => {
        if (!active) return
        const nextSnapshot = response.snapshot || null
        setSnapshot(nextSnapshot)
        setPlanForm(planToForm(nextSnapshot?.plan))
        setError('')
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Client 360 could not be loaded.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [clientId])

  useEffect(() => {
    if (adminUser?.role !== 'staff') return
    getMyTeamAccess()
      .then((response) => setTeamAccess(response.access || null))
      .catch(() => setTeamAccess({ permissions: {} }))
  }, [adminUser?.role])

  const filteredActions = useMemo(() => {
    const actions = snapshot?.actions || []
    if (actionFilter === 'all') return actions
    if (actionFilter === 'completed') return actions.filter((action) => action.status === 'completed')
    return actions.filter((action) => ['open', 'in_progress'].includes(action.status))
  }, [actionFilter, snapshot?.actions])

  async function handlePlanSubmit(event) {
    event.preventDefault()
    if (!canManage) return

    setIsSavingPlan(true)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminClientCarePlan(clientId, {
        ...planForm,
        nextReviewAt: planForm.nextReviewAt || null,
      })
      setSnapshot(response.snapshot)
      setPlanForm(planToForm(response.snapshot?.plan))
      setNotice(response.message || 'Client care plan saved.')
    } catch (saveError) {
      setError(saveError.message || 'The care plan could not be saved.')
    } finally {
      setIsSavingPlan(false)
    }
  }

  async function handleActionSubmit(event) {
    event.preventDefault()
    if (!canManage) return

    setIsSavingAction(true)
    setError('')
    setNotice('')

    try {
      const response = await createAdminClientCareAction(clientId, {
        ...actionForm,
        ownerUserId: actionForm.ownerUserId || null,
        dueAt: actionForm.dueAt || null,
      })
      setSnapshot(response.snapshot)
      setActionForm(emptyAction)
      setNotice(response.message || 'Care action created.')
    } catch (saveError) {
      setError(saveError.message || 'The care action could not be created.')
    } finally {
      setIsSavingAction(false)
    }
  }

  async function changeActionStatus(action, status) {
    if (!canManage) return

    setUpdatingActionId(action.id)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminClientCareAction(clientId, action.id, { status })
      setSnapshot(response.snapshot)
      setNotice(response.message || 'Care action updated.')
    } catch (updateError) {
      setError(updateError.message || 'The care action could not be updated.')
    } finally {
      setUpdatingActionId('')
    }
  }

  if (isLoading) {
    return (
      <AdminFrame>
        <div className="client-360-loading">Loading the complete client workspace…</div>
      </AdminFrame>
    )
  }

  if (!snapshot) {
    return (
      <AdminFrame>
        <div className="client-360-error-state">
          <p className="admin-eyebrow">Client 360</p>
          <h1>Client workspace unavailable</h1>
          <p>{error || 'The selected client profile could not be found.'}</p>
          <Link className="btn primary" to="/admin/clients">Return to Clients</Link>
        </div>
      </AdminFrame>
    )
  }

  const { client, summary, plan } = snapshot
  const nextSession = [...(snapshot.bookings || [])]
    .filter((booking) => ['requested', 'approved', 'confirmed'].includes(booking.status))
    .filter((booking) => new Date(booking.starts_at).getTime() >= renderNow)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0]

  return (
    <AdminFrame>
      <div className="client-360-page">
        <header className="client-360-hero">
          <div>
            <div className="client-360-breadcrumbs">
              <Link to="/admin/clients">Clients</Link>
              <span>/</span>
              <span>Client 360</span>
            </div>
            <p className="admin-eyebrow">Complete Care Workspace</p>
            <h1>{client.name}</h1>
            <p>
              One operational view for the client journey, care plan, next actions,
              sessions, messages, learning, membership, and assigned team.
            </p>
          </div>

          <div className="client-360-hero-actions">
            <span className={`client-360-status is-${plan.careStatus}`}>
              {titleCase(plan.careStatus)}
            </span>
            <Link className="btn secondary" to={`/admin/clients/${client.id}/overview`}>
              Edit profile
            </Link>
            <button className="btn primary" type="button" onClick={() => loadSnapshot()}>
              Refresh workspace
            </button>
          </div>
        </header>

        {error && <div className="client-360-alert is-error" role="alert">{error}</div>}
        {notice && <div className="client-360-alert is-success" role="status">{notice}</div>}
        {!canManage && (
          <div className="client-360-alert is-view-only" role="status">
            This client workspace is view-only for your current team permission level.
          </div>
        )}

        <section className="client-360-pulse" aria-label="Client care pulse">
          <article className={summary.overdueActions ? 'needs-attention' : ''}>
            <span>Open actions</span>
            <strong>{summary.openActions}</strong>
            <small>{summary.overdueActions} overdue</small>
          </article>
          <article>
            <span>Upcoming sessions</span>
            <strong>{summary.upcomingSessions}</strong>
            <small>{nextSession ? formatDate(nextSession.starts_at, { hour: 'numeric', minute: '2-digit' }) : 'Nothing scheduled'}</small>
          </article>
          <article className={summary.unreadMessages ? 'needs-attention' : ''}>
            <span>Open inbox</span>
            <strong>{summary.openConversations}</strong>
            <small>{summary.unreadMessages} unread message(s)</small>
          </article>
          <article>
            <span>Programs</span>
            <strong>{summary.activeCourses + summary.activeMemberships}</strong>
            <small>{summary.activeCourses} learning · {summary.activeMemberships} membership</small>
          </article>
        </section>

        <nav className="client-360-section-nav" aria-label="Client 360 sections">
          <a href="#care-plan">Care plan</a>
          <a href="#actions">Action center</a>
          <a href="#journey">Journey activity</a>
          <a href="#programs">Programs</a>
          <a href="#care-team">Care team</a>
        </nav>

        <div className="client-360-layout">
          <main className="client-360-primary">
            <section className="client-360-card" id="care-plan">
              <div className="client-360-card-heading">
                <div>
                  <p className="admin-eyebrow">Strategic Care</p>
                  <h2>Transformation plan</h2>
                  <p>Define where the client is now, what matters next, and what success looks like.</p>
                </div>
                <span>Updated {formatDate(plan.updatedAt)}</span>
              </div>

              <form className="client-360-plan-form" onSubmit={handlePlanSubmit}>
                <label>
                  <span>Journey stage</span>
                  <select
                    value={planForm.journeyStage}
                    onChange={(event) => setPlanForm((current) => ({ ...current, journeyStage: event.target.value }))}
                    disabled={!canManage}
                  >
                    <option value="onboarding">Onboarding</option>
                    <option value="clarity">Clarity</option>
                    <option value="active_work">Active Work</option>
                    <option value="integration">Integration</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>

                <label>
                  <span>Care status</span>
                  <select
                    value={planForm.careStatus}
                    onChange={(event) => setPlanForm((current) => ({ ...current, careStatus: event.target.value }))}
                    disabled={!canManage}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="on_track">On Track</option>
                    <option value="attention">Needs Attention</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label>
                  <span>Next review</span>
                  <input
                    type="datetime-local"
                    value={planForm.nextReviewAt}
                    onChange={(event) => setPlanForm((current) => ({ ...current, nextReviewAt: event.target.value }))}
                    disabled={!canManage}
                  />
                </label>

                <label className="is-wide">
                  <span>Primary goal</span>
                  <textarea
                    rows="3"
                    value={planForm.primaryGoal}
                    onChange={(event) => setPlanForm((current) => ({ ...current, primaryGoal: event.target.value }))}
                    placeholder="What is the most important transformation outcome right now?"
                    disabled={!canManage}
                  />
                </label>

                <label className="is-wide">
                  <span>Transformation focus</span>
                  <textarea
                    rows="4"
                    value={planForm.transformationFocus}
                    onChange={(event) => setPlanForm((current) => ({ ...current, transformationFocus: event.target.value }))}
                    placeholder="Confidence, presence, image, style, routines, communication, or another focus."
                    disabled={!canManage}
                  />
                </label>

                <label>
                  <span>Success definition</span>
                  <textarea
                    rows="5"
                    value={planForm.successDefinition}
                    onChange={(event) => setPlanForm((current) => ({ ...current, successDefinition: event.target.value }))}
                    placeholder="How will the team know meaningful progress has happened?"
                    disabled={!canManage}
                  />
                </label>

                <label>
                  <span>Client-visible focus</span>
                  <textarea
                    rows="5"
                    value={planForm.clientVisibleFocus}
                    onChange={(event) => setPlanForm((current) => ({ ...current, clientVisibleFocus: event.target.value }))}
                    placeholder="A supportive focus statement suitable for the client portal."
                    disabled={!canManage}
                  />
                </label>

                <label className="is-wide is-private">
                  <span>Private strategy notes</span>
                  <textarea
                    rows="6"
                    value={planForm.privateStrategyNotes}
                    onChange={(event) => setPlanForm((current) => ({ ...current, privateStrategyNotes: event.target.value }))}
                    placeholder="Internal care strategy, concerns, context, and coordination notes."
                    disabled={!canManage}
                  />
                </label>

                <div className="client-360-form-actions is-wide">
                  <span>Private strategy notes never appear in the Client Portal.</span>
                  <button className="btn primary" type="submit" disabled={!canManage || isSavingPlan}>
                    {isSavingPlan ? 'Saving plan…' : 'Save care plan'}
                  </button>
                </div>
              </form>
            </section>

            <section className="client-360-card" id="actions">
              <div className="client-360-card-heading">
                <div>
                  <p className="admin-eyebrow">Action Center</p>
                  <h2>Next best actions</h2>
                  <p>Turn the care plan into clear, owned, time-bound follow-through.</p>
                </div>
                <div className="client-360-filter-tabs">
                  {['active', 'completed', 'all'].map((filter) => (
                    <button
                      className={actionFilter === filter ? 'is-active' : ''}
                      type="button"
                      key={filter}
                      onClick={() => setActionFilter(filter)}
                    >
                      {titleCase(filter)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="client-360-actions-grid">
                <div className="client-360-action-list">
                  {filteredActions.map((action) => {
                    const overdue = action.dueAt && ['open', 'in_progress'].includes(action.status) && new Date(action.dueAt).getTime() < renderNow
                    return (
                      <article className={`client-360-action is-${action.priority}${overdue ? ' is-overdue' : ''}`} key={action.id}>
                        <div className="client-360-action-topline">
                          <span>{titleCase(action.status)}</span>
                          <span>{titleCase(action.priority)}</span>
                        </div>
                        <h3>{action.title}</h3>
                        {action.description && <p>{action.description}</p>}
                        <dl>
                          <div><dt>Owner</dt><dd>{action.ownerName || 'Unassigned'}</dd></div>
                          <div><dt>Due</dt><dd>{formatDate(action.dueAt)}</dd></div>
                          <div><dt>Visibility</dt><dd>{titleCase(action.visibility)}</dd></div>
                        </dl>
                        {canManage && action.status !== 'cancelled' && (
                          <div className="client-360-action-buttons">
                            {action.status === 'open' && (
                              <button type="button" onClick={() => changeActionStatus(action, 'in_progress')} disabled={updatingActionId === action.id}>Start</button>
                            )}
                            {action.status !== 'completed' && (
                              <button type="button" onClick={() => changeActionStatus(action, 'completed')} disabled={updatingActionId === action.id}>Complete</button>
                            )}
                            {action.status === 'completed' && (
                              <button type="button" onClick={() => changeActionStatus(action, 'open')} disabled={updatingActionId === action.id}>Reopen</button>
                            )}
                            {action.status !== 'completed' && (
                              <button className="is-quiet" type="button" onClick={() => changeActionStatus(action, 'cancelled')} disabled={updatingActionId === action.id}>Cancel</button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}

                  {!filteredActions.length && (
                    <div className="client-360-empty">
                      <strong>No action items in this view.</strong>
                      <p>Create a next best action to make the plan operational.</p>
                    </div>
                  )}
                </div>

                <form className="client-360-action-form" onSubmit={handleActionSubmit}>
                  <p className="admin-eyebrow">Create Action</p>
                  <h3>Add the next step</h3>

                  <label>
                    <span>Action title</span>
                    <input
                      value={actionForm.title}
                      onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Prepare the personal color summary"
                      required
                      disabled={!canManage}
                    />
                  </label>

                  <label>
                    <span>Description</span>
                    <textarea
                      rows="4"
                      value={actionForm.description}
                      onChange={(event) => setActionForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add enough context for the assigned team member."
                      disabled={!canManage}
                    />
                  </label>

                  <label>
                    <span>Owner</span>
                    <select
                      value={actionForm.ownerUserId}
                      onChange={(event) => setActionForm((current) => ({ ...current, ownerUserId: event.target.value }))}
                      disabled={!canManage}
                    >
                      <option value="">Unassigned</option>
                      {(snapshot.team || []).map((member) => (
                        <option value={member.userId} key={member.userId}>
                          {member.displayName} · {titleCase(member.assignmentRole)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="client-360-action-form-row">
                    <label>
                      <span>Due</span>
                      <input
                        type="datetime-local"
                        value={actionForm.dueAt}
                        onChange={(event) => setActionForm((current) => ({ ...current, dueAt: event.target.value }))}
                        disabled={!canManage}
                      />
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={actionForm.priority}
                        onChange={(event) => setActionForm((current) => ({ ...current, priority: event.target.value }))}
                        disabled={!canManage}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Visibility</span>
                    <select
                      value={actionForm.visibility}
                      onChange={(event) => setActionForm((current) => ({ ...current, visibility: event.target.value }))}
                      disabled={!canManage}
                    >
                      <option value="team">Team only</option>
                      <option value="client">Client visible</option>
                    </select>
                  </label>

                  <button className="btn primary" type="submit" disabled={!canManage || isSavingAction}>
                    {isSavingAction ? 'Creating action…' : 'Create action'}
                  </button>
                </form>
              </div>
            </section>

            <section className="client-360-card" id="journey">
              <div className="client-360-card-heading">
                <div>
                  <p className="admin-eyebrow">Journey Activity</p>
                  <h2>Recent care history</h2>
                  <p>Sessions, service records, and secure inbox activity in one chronological stream.</p>
                </div>
              </div>

              <div className="client-360-timeline">
                {(snapshot.activity || []).map((activity) => (
                  <article key={activity.id}>
                    <span className={`client-360-activity-icon is-${activity.type}`} aria-hidden="true" />
                    <div>
                      <div><strong>{activity.title}</strong><time>{formatDate(activity.occurredAt, { hour: 'numeric', minute: '2-digit' })}</time></div>
                      <p>{titleCase(activity.detail)}</p>
                    </div>
                  </article>
                ))}
                {!snapshot.activity?.length && <div className="client-360-empty"><strong>No journey activity yet.</strong></div>}
              </div>
            </section>

            <section className="client-360-card" id="programs">
              <div className="client-360-card-heading">
                <div>
                  <p className="admin-eyebrow">Learning & Membership</p>
                  <h2>Program engagement</h2>
                  <p>See what the client can access and how far they have progressed.</p>
                </div>
              </div>

              <div className="client-360-program-grid">
                <section>
                  <h3>Learning</h3>
                  {(snapshot.learning || []).map((course) => (
                    <article key={course.course_id}>
                      <div><strong>{course.title}</strong><span>{titleCase(course.access_status)}</span></div>
                      <div className="client-360-progress"><span style={{ width: `${course.progressPercent}%` }} /></div>
                      <small>{course.completed_lessons} of {course.lesson_count} lessons · {course.progressPercent}%</small>
                    </article>
                  ))}
                  {!snapshot.learning?.length && <p className="client-360-muted">No learning assignments yet.</p>}
                </section>

                <section>
                  <h3>Memberships</h3>
                  {(snapshot.memberships || []).map((membership) => (
                    <article key={membership.enrollment_id}>
                      <div><strong>{membership.name}</strong><span>{titleCase(membership.status)}</span></div>
                      <p>{membership.tagline || 'Power Within membership experience'}</p>
                      <small>Started {formatDate(membership.started_at)}{membership.renewal_at ? ` · Renews ${formatDate(membership.renewal_at)}` : ''}</small>
                    </article>
                  ))}
                  {!snapshot.memberships?.length && <p className="client-360-muted">No membership enrollment yet.</p>}
                </section>
              </div>
            </section>
          </main>

          <aside className="client-360-sidebar">
            <section className="client-360-card client-360-profile-card">
              <div className="client-360-avatar" aria-hidden="true">
                {(client.firstName?.[0] || 'C')}{client.lastName?.[0] || ''}
              </div>
              <h2>{client.name}</h2>
              <p>{client.email || 'No email saved'}</p>
              <dl>
                <div><dt>Client status</dt><dd>{titleCase(client.clientStatus)}</dd></div>
                <div><dt>Portal</dt><dd>{titleCase(client.portalStatus || 'not active')}</dd></div>
                <div><dt>Phone</dt><dd>{client.phone || 'Not saved'}</dd></div>
                <div><dt>Intake</dt><dd>{client.intakeCompletedAt ? 'Complete' : 'Pending'}</dd></div>
                <div><dt>Last login</dt><dd>{formatDate(client.lastLoginAt)}</dd></div>
              </dl>
              {!!client.tags?.length && (
                <div className="client-360-tags">
                  {client.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
                </div>
              )}
            </section>

            <section className="client-360-card" id="care-team">
              <div className="client-360-side-heading">
                <p className="admin-eyebrow">Care Team</p>
                <h2>Assigned people</h2>
              </div>
              <div className="client-360-team-list">
                {(snapshot.team || []).map((member) => (
                  <article key={member.userId}>
                    <span className={`client-360-team-dot is-${member.availabilityStatus || 'away'}`} />
                    <div><strong>{member.displayName}</strong><p>{member.jobTitle || titleCase(member.role)}</p></div>
                    <small>{titleCase(member.assignmentRole)}</small>
                  </article>
                ))}
                {!snapshot.team?.length && (
                  <div className="client-360-empty is-compact">
                    <strong>No care team assigned.</strong>
                    <p>Assign Admin or Staff from Staff & Team Management.</p>
                  </div>
                )}
              </div>
              {adminUser?.role === 'developer' && (
                <Link className="client-360-text-link" to="/admin/team">Manage team assignments</Link>
              )}
            </section>

            <section className="client-360-card client-360-next-session">
              <div className="client-360-side-heading">
                <p className="admin-eyebrow">Next Session</p>
                <h2>{nextSession?.appointment_type_name || 'Not scheduled'}</h2>
              </div>
              {nextSession ? (
                <>
                  <strong>{formatDate(nextSession.starts_at, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</strong>
                  <p>{titleCase(nextSession.status)} · {nextSession.timezone}</p>
                  <Link className="client-360-text-link" to="/admin/scheduler">Open Session Studio</Link>
                </>
              ) : (
                <p>No upcoming confirmed or requested session is connected to this client.</p>
              )}
            </section>

            <section className="client-360-card client-360-quick-links">
              <div className="client-360-side-heading">
                <p className="admin-eyebrow">Connected Workspaces</p>
                <h2>Open related areas</h2>
              </div>
              <Link to={`/admin/clients/${client.id}/care`}>Care records</Link>
              <Link to={`/admin/clients/${client.id}/portal`}>Portal access</Link>
              <Link to="/admin/inbox">Secure Inbox</Link>
              <Link to="/admin/scheduler">Sessions</Link>
              <Link to="/admin/courses">Learning Library</Link>
              <Link to="/admin/memberships">Memberships</Link>
            </section>
          </aside>
        </div>
      </div>
    </AdminFrame>
  )
}

export default AdminClient360
