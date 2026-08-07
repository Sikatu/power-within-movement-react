import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminSessionChangeRequests,
  getAdminSessionFollowThrough,
  getAdminSessionReadiness,
  getMyTeamAccess,
  reviewAdminSessionChangeRequest,
  updateAdminBookingStatus,
} from '../../lib/nativeApi'

const SessionsActionContext = createContext(null)

const modes = [
  ['upcoming', 'Upcoming'],
  ['follow-through', 'Follow-through'],
  ['changes', 'Change requests'],
]

const modeFilters = {
  upcoming: [
    ['all', 'All upcoming'],
    ['attention', 'Needs attention'],
    ['ready', 'Ready'],
  ],
  'follow-through': [
    ['all', 'All recent'],
    ['attention', 'Needs follow-through'],
    ['complete', 'Continuity set'],
  ],
  changes: [
    ['pending', 'Needs review'],
    ['history', 'History'],
    ['all', 'All changes'],
  ],
}

function label(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .toLowerCase()
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function initials(value) {
  return String(value || 'Client')
    .trim()
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'
}

function changeClientName(request) {
  return (
    [request.client_first_name, request.client_last_name]
      .filter(Boolean)
      .join(' ')
    || request.client_email
    || 'Client'
  )
}

function sessionMatches(session, query) {
  const search = query.trim().toLowerCase()
  if (!search) return true
  return [
    session.clientName,
    session.clientEmail,
    session.clientPhone,
    session.appointmentTypeName,
    session.status,
    session.readiness?.label,
    session.followThrough?.label,
    ...(session.assignedMembers || []).map(
      (member) => member.displayName || member.email,
    ),
  ].some((value) => String(value || '').toLowerCase().includes(search))
}

function changeMatches(request, query) {
  const search = query.trim().toLowerCase()
  if (!search) return true
  return [
    changeClientName(request),
    request.client_email,
    request.appointment_type_name,
    request.request_type,
    request.status,
    request.reason,
  ].some((value) => String(value || '').toLowerCase().includes(search))
}

function DetailFact({ label: factLabel, value }) {
  return (
    <div>
      <span>{factLabel}</span>
      <strong>{value || 'Not recorded'}</strong>
    </div>
  )
}

function SessionCard({ mode, session, selected, onSelect }) {
  const signal = mode === 'upcoming' ? session.readiness : session.followThrough
  return (
    <button
      type="button"
      className={`studio-session-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(session.id)}
    >
      <span className="studio-session-card-avatar" aria-hidden="true">
        {initials(session.clientName)}
      </span>
      <span className="studio-session-card-copy">
        <span className="studio-session-card-topline">
          <strong>{session.clientName}</strong>
          <small className={`is-${signal?.band || 'ready'}`}>
            {signal?.label || label(session.status)}
          </small>
        </span>
        <span>{session.appointmentTypeName || 'Private session'}</span>
        <span className="studio-session-card-meta">
          <span>{formatDateTime(session.startsAt)}</span>
          <span>{label(session.status)}</span>
        </span>
      </span>
    </button>
  )
}

function ChangeCard({ request, selected, onSelect }) {
  const name = changeClientName(request)
  return (
    <button
      type="button"
      className={`studio-session-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(request.id)}
    >
      <span className="studio-session-card-avatar" aria-hidden="true">
        {initials(name)}
      </span>
      <span className="studio-session-card-copy">
        <span className="studio-session-card-topline">
          <strong>{name}</strong>
          <small className={`is-${request.status || 'pending'}`}>
            {label(request.status || 'pending')}
          </small>
        </span>
        <span>
          {request.request_type === 'cancel'
            ? 'Cancellation request'
            : 'Reschedule request'}
        </span>
        <span className="studio-session-card-meta">
          <span>
            {request.request_type === 'reschedule'
              ? formatDateTime(request.requested_starts_at)
              : formatDateTime(request.current_starts_at)}
          </span>
          <span>{request.appointment_type_name || 'Session'}</span>
        </span>
      </span>
    </button>
  )
}

function SessionHeader({ session, eyebrow }) {
  return (
    <header className="studio-session-detail-header">
      <div className="studio-session-detail-identity">
        <span aria-hidden="true">{initials(session.clientName)}</span>
        <div>
          <p className="studio-v2-eyebrow">{eyebrow}</p>
          <h2>{session.clientName}</h2>
          <p>{session.clientEmail || 'No email saved'}</p>
        </div>
      </div>
      <div className="studio-session-detail-actions">
        {session.clientProfileId && (
          <Link
            className="studio-v2-button is-primary"
            to={`/admin/client-360/${session.clientProfileId}`}
          >
            Open Client 360
          </Link>
        )}
        <Link
          className="studio-v2-button is-secondary"
          to={`/admin/scheduler?booking=${session.id}`}
        >
          Legacy session
        </Link>
      </div>
    </header>
  )
}

function SignalHero({ eyebrow, signal }) {
  return (
    <section className="studio-session-signal-hero">
      <div>
        <p className="studio-v2-eyebrow">{eyebrow}</p>
        <h3>{signal?.label || 'Session review'}</h3>
        <p>{signal?.primaryReason || 'No session-care issue is currently surfaced.'}</p>
      </div>
      <strong className={`is-${signal?.band || 'ready'}`}>
        {signal?.score ?? 0}<small>/100</small>
      </strong>
    </section>
  )
}

function SignalReasons({ eyebrow, signal }) {
  const reasons = signal?.reasons || []
  return (
    <section className="studio-session-reasons">
      <header>
        <div>
          <p className="studio-v2-eyebrow">{eyebrow}</p>
          <h3>{reasons.length ? 'What needs attention' : 'Everything is current'}</h3>
        </div>
        <span>{reasons.length} signal{reasons.length === 1 ? '' : 's'}</span>
      </header>
      {reasons.length ? (
        <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      ) : (
        <p className="studio-session-calm-copy">No active signal is being surfaced.</p>
      )}
    </section>
  )
}

function TeamPanel({ members }) {
  const team = members || []
  return (
    <section className="studio-session-team">
      <div>
        <p className="studio-v2-eyebrow">Care team</p>
        <h3>{team.length ? `${team.length} assigned` : 'No team assigned'}</h3>
      </div>
      <div>
        {team.map((member) => (
          <span key={member.id}>
            <strong>{member.displayName}</strong>
            <small>{label(member.assignmentRole)}</small>
          </span>
        ))}
        {!team.length && (
          <p>Assignments remain available through Client 360 and Legacy Studio.</p>
        )}
      </div>
    </section>
  )
}


function SessionStatusActions({ mode, session }) {
  const actions = useContext(SessionsActionContext)
  if (!actions) return null

  const {
    busyAction,
    canManageSessions,
    requestBookingStatus,
  } = actions

  const currentStatus = session.status || 'requested'
  const isPast = mode === 'follow-through'

  const nextAction = currentStatus === 'requested'
    ? { status: 'approved', label: 'Approve request' }
    : currentStatus === 'approved'
      ? { status: 'confirmed', label: 'Mark confirmed' }
      : currentStatus === 'confirmed'
        ? { status: 'completed', label: 'Complete session' }
        : null

  const canClose = ['requested', 'approved', 'confirmed'].includes(currentStatus)
  const isBusy = busyAction === `booking:${session.id}`

  return (
    <section className="studio-session-action-panel">
      <div>
        <p className="studio-v2-eyebrow">Session actions</p>
        <h3>{canManageSessions ? 'Move the session forward' : 'View-only access'}</h3>
        <p>
          {canManageSessions
            ? 'Status changes use the existing secured booking workflow and preserve private Studio notes.'
            : 'Your Studio role can review this session but cannot change its status.'}
        </p>
      </div>

      {canManageSessions && (
        <div className="studio-session-action-buttons">
          {nextAction && (
            <button
              className="studio-v2-button is-primary"
              disabled={isBusy}
              onClick={() => requestBookingStatus(session, nextAction.status)}
              type="button"
            >
              {nextAction.label}
            </button>
          )}

          {isPast && canClose && (
            <button
              className="studio-v2-button is-secondary"
              disabled={isBusy}
              onClick={() => requestBookingStatus(session, 'no_show')}
              type="button"
            >
              Mark no-show
            </button>
          )}

          {canClose && (
            <button
              className="studio-session-danger-button"
              disabled={isBusy}
              onClick={() => requestBookingStatus(session, 'cancelled')}
              type="button"
            >
              Cancel session
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function SessionConfirmDialog({
  busy,
  confirmation,
  onCancel,
  onConfirm,
}) {
  if (!confirmation) return null

  return (
    <div className="studio-session-dialog-scrim">
      <section
        aria-labelledby="studio-session-confirm-title"
        aria-modal="true"
        className="studio-session-dialog"
        role="dialog"
      >
        <p className="studio-v2-eyebrow">Confirm session change</p>
        <h2 id="studio-session-confirm-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>
        <small>{confirmation.detail}</small>

        <div>
          <button
            className="studio-v2-button is-secondary"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Keep current state
          </button>

          <button
            className={confirmation.tone === 'danger'
              ? 'studio-session-dialog-danger'
              : 'studio-v2-button is-primary'}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'Saving...' : confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function ChangeRequestActions({ request }) {
  const actions = useContext(SessionsActionContext)
  if (!actions) return null

  const {
    busyAction,
    canManageSessions,
    requestChangeDecision,
    reviewNotes,
    setReviewNote,
  } = actions

  if (request.status !== 'pending') {
    return (
      <aside className="studio-session-legacy-action-note">
        <strong>Review complete</strong>
        <span>
          This request is retained in session history with its reviewer and private note.
        </span>
        <Link to="/admin/session-change-requests">Open Legacy review</Link>
      </aside>
    )
  }

  if (!canManageSessions) {
    return (
      <aside className="studio-session-legacy-action-note">
        <strong>View-only access</strong>
        <span>
          A Sessions manager must approve or decline this client request.
        </span>
        <Link to="/admin/session-change-requests">Open Legacy review</Link>
      </aside>
    )
  }

  const isBusy = busyAction === `change:${request.id}`

  return (
    <section className="studio-session-change-actions">
      <div>
        <p className="studio-v2-eyebrow">Protected review</p>
        <h3>Decide the client request</h3>
        <p>
          Approval applies the requested booking change. Declining leaves the
          existing booking unchanged.
        </p>
      </div>

      <label>
        <span>Private reviewer note</span>
        <textarea
          onChange={(event) => setReviewNote(request.id, event.target.value)}
          placeholder="Add internal context for this decision."
          rows="3"
          value={reviewNotes[request.id] || ''}
        />
      </label>

      <div className="studio-session-change-action-buttons">
        <button
          className="studio-v2-button is-primary"
          disabled={isBusy}
          onClick={() => requestChangeDecision(request, 'approved')}
          type="button"
        >
          Approve request
        </button>

        <button
          className="studio-session-danger-button"
          disabled={isBusy}
          onClick={() => requestChangeDecision(request, 'declined')}
          type="button"
        >
          Decline request
        </button>
      </div>
    </section>
  )
}

function UpcomingDetail({ session }) {
  return (
    <>
      <SessionHeader session={session} eyebrow="Upcoming session" />
      <SignalHero eyebrow="Preparation signal" signal={session.readiness} />
      <SessionStatusActions mode="upcoming" session={session} />
      <section className="studio-session-facts">
        <DetailFact label="Session" value={session.appointmentTypeName} />
        <DetailFact label="Starts" value={formatDateTime(session.startsAt)} />
        <DetailFact label="Duration" value={session.durationMinutes ? `${session.durationMinutes} minutes` : 'Not recorded'} />
        <DetailFact label="Status" value={label(session.status)} />
        <DetailFact label="Timezone" value={session.timezone} />
        <DetailFact label="Phone" value={session.clientPhone} />
      </section>
      <div className="studio-session-detail-grid">
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Client readiness</p><h3>Before the session</h3></header>
          <dl>
            <div><dt>Intake</dt><dd>{session.requiredIntakeFields ? `${session.answeredRequiredFields} of ${session.requiredIntakeFields} required responses` : 'No required intake fields'}</dd></div>
            <div><dt>Portal</dt><dd>{session.portalActive ? 'Active' : 'Not active'}</dd></div>
            <div><dt>Onboarding</dt><dd>{session.onboardingRequired ? label(session.onboardingStatus || 'not started') : 'Not required'}</dd></div>
            <div><dt>Care status</dt><dd>{label(session.careStatus || 'not started')}</dd></div>
            <div><dt>Primary goal</dt><dd>{session.primaryGoal || 'No primary goal recorded.'}</dd></div>
          </dl>
        </article>
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Studio attention</p><h3>What needs awareness</h3></header>
          <dl>
            <div><dt>Active care actions</dt><dd>{session.activeTasks || 0}</dd></div>
            <div><dt>Overdue care actions</dt><dd>{session.overdueTasks || 0}</dd></div>
            <div><dt>Waiting on team</dt><dd>{session.waitingOnTeam || 0}</dd></div>
            <div><dt>Confirmation</dt><dd>{session.communications?.confirmationSentAt ? formatDateTime(session.communications.confirmationSentAt) : 'Not recorded as sent'}</dd></div>
          </dl>
        </article>
      </div>
      <SignalReasons eyebrow="Preparation notes" signal={session.readiness} />
      <TeamPanel members={session.assignedMembers} />
    </>
  )
}

function FollowThroughDetail({ session }) {
  return (
    <>
      <SessionHeader session={session} eyebrow="Recent session" />
      <SignalHero eyebrow="Follow-through signal" signal={session.followThrough} />
      <SessionStatusActions mode="follow-through" session={session} />
      <section className="studio-session-facts">
        <DetailFact label="Session" value={session.appointmentTypeName} />
        <DetailFact label="Occurred" value={formatDateTime(session.startsAt)} />
        <DetailFact label="Status" value={label(session.status)} />
        <DetailFact label="Resources shared" value={String(session.resourcesShared || 0)} />
        <DetailFact label="Active actions" value={String(session.activeTasks || 0)} />
        <DetailFact label="Waiting on team" value={String(session.waitingOnTeam || 0)} />
      </section>
      <div className="studio-session-detail-grid">
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Session record</p><h3>{session.sessionRecord?.title || 'No record connected'}</h3></header>
          {session.sessionRecord ? (
            <dl>
              <div><dt>Summary</dt><dd>{session.sessionRecord.summary || 'No summary recorded.'}</dd></div>
              <div><dt>Recorded</dt><dd>{formatDateTime(session.sessionRecord.recordedAt)}</dd></div>
              <div><dt>Follow-up</dt><dd>{formatDateTime(session.sessionRecord.followUpAt)}</dd></div>
            </dl>
          ) : (
            <p className="studio-session-calm-copy">A completed-session record has not been connected to this appointment.</p>
          )}
        </article>
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Continuity</p><h3>Next care step</h3></header>
          <dl>
            <div><dt>Overdue actions</dt><dd>{session.overdueTasks || 0}</dd></div>
            <div><dt>Urgent actions</dt><dd>{session.urgentTasks || 0}</dd></div>
            <div><dt>Next session</dt><dd>{session.nextSessionAt ? `${session.nextSessionName || 'Session'} - ${formatDateTime(session.nextSessionAt)}` : 'Not scheduled'}</dd></div>
            <div><dt>Care stage</dt><dd>{label(session.journeyStage || 'not recorded')}</dd></div>
          </dl>
        </article>
      </div>
      <SignalReasons eyebrow="Follow-through notes" signal={session.followThrough} />
      <TeamPanel members={session.assignedMembers} />
    </>
  )
}

function ChangeDetail({ request }) {
  const name = changeClientName(request)
  return (
    <>
      <header className="studio-session-detail-header">
        <div className="studio-session-detail-identity">
          <span aria-hidden="true">{initials(name)}</span>
          <div>
            <p className="studio-v2-eyebrow">{request.request_type === 'cancel' ? 'Cancellation request' : 'Reschedule request'}</p>
            <h2>{name}</h2>
            <p>{request.client_email || 'No email saved'}</p>
          </div>
        </div>
        <div className="studio-session-detail-actions">
          {request.client_profile_id && (
            <Link className="studio-v2-button is-primary" to={`/admin/client-360/${request.client_profile_id}`}>Open Client 360</Link>
          )}
          <Link className="studio-v2-button is-secondary" to="/admin/session-change-requests">Legacy review</Link>
        </div>
      </header>
      <section className="studio-session-change-hero">
        <div>
          <p className="studio-v2-eyebrow">Client request</p>
          <h3>{request.status === 'pending' ? 'Needs review' : label(request.status)}</h3>
          <p>{request.reason || 'No reason was provided.'}</p>
        </div>
        <span className={`is-${request.status || 'pending'}`}>{label(request.status || 'pending')}</span>
      </section>
      <section className="studio-session-facts">
        <DetailFact label="Session" value={request.appointment_type_name || 'Private session'} />
        <DetailFact label="Request type" value={label(request.request_type)} />
        <DetailFact label="Current time" value={formatDateTime(request.current_starts_at)} />
        <DetailFact label="Requested time" value={request.request_type === 'reschedule' ? formatDateTime(request.requested_starts_at) : 'Not applicable'} />
        <DetailFact label="Submitted" value={formatDateTime(request.created_at)} />
        <DetailFact label="Booking status" value={label(request.booking_status)} />
      </section>
      <div className="studio-session-detail-grid">
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Client reason</p><h3>What changed</h3></header>
          <p className="studio-session-change-reason">{request.reason || 'No reason was provided.'}</p>
        </article>
        <article className="studio-session-context-card">
          <header><p className="studio-v2-eyebrow">Review history</p><h3>{request.status === 'pending' ? 'Awaiting Studio review' : 'Reviewed'}</h3></header>
          <dl>
            <div><dt>Reviewer</dt><dd>{request.reviewer_email || 'Not reviewed yet'}</dd></div>
            <div><dt>Reviewed</dt><dd>{formatDateTime(request.reviewed_at)}</dd></div>
            <div><dt>Private review note</dt><dd>{request.reviewer_notes || 'No review note recorded.'}</dd></div>
          </dl>
        </article>
      </div>
      <ChangeRequestActions request={request} />
    </>
  )
}

export default function StudioSessions() {
  const [readiness, setReadiness] = useState(null)
  const [followThrough, setFollowThrough] = useState(null)
  const [changeRequests, setChangeRequests] = useState([])
  const [mode, setMode] = useState('upcoming')
  const [filters, setFilters] = useState({ upcoming: 'all', 'follow-through': 'all', changes: 'pending' })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [teamAccess, setTeamAccess] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [reviewNotes, setReviewNotes] = useState({})

  const loadSessions = useCallback(async ({ preserveSelection = true } = {}) => {
    setLoading(true)
    setError('')
    try {
      const [
        readinessResult,
        followResult,
        changeResult,
        accessResult,
      ] = await Promise.all([
        getAdminSessionReadiness(30),
        getAdminSessionFollowThrough(30),
        getAdminSessionChangeRequests(),
        getMyTeamAccess(),
      ])
      setReadiness(readinessResult)
      setFollowThrough(followResult)
      setChangeRequests(changeResult.requests || [])
      setTeamAccess(accessResult)
      if (!preserveSelection) {
        setSelectedId(
          readinessResult.sessions?.[0]?.id
          || followResult.sessions?.[0]?.id
          || changeResult.requests?.[0]?.id
          || '',
        )
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Sessions workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadSessions({ preserveSelection: false }), 0)
    return () => window.clearTimeout(timer)
  }, [loadSessions])

  const pendingChanges = useMemo(
    () => changeRequests.filter((request) => request.status === 'pending'),
    [changeRequests],
  )
  const followAttention = useMemo(
    () => (followThrough?.sessions || []).filter((session) => session.followThrough?.band !== 'complete').length,
    [followThrough?.sessions],
  )
  const activeFilter = filters[mode]

  const visibleRecords = useMemo(() => {
    if (mode === 'upcoming') {
      return (readiness?.sessions || [])
        .filter((session) => {
          if (activeFilter === 'attention') return session.readiness?.band !== 'ready'
          if (activeFilter === 'ready') return session.readiness?.band === 'ready'
          return true
        })
        .filter((session) => sessionMatches(session, search))
    }
    if (mode === 'follow-through') {
      return (followThrough?.sessions || [])
        .filter((session) => {
          if (activeFilter === 'attention') return session.followThrough?.band !== 'complete'
          if (activeFilter === 'complete') return session.followThrough?.band === 'complete'
          return true
        })
        .filter((session) => sessionMatches(session, search))
    }
    return changeRequests
      .filter((request) => {
        if (activeFilter === 'pending') return request.status === 'pending'
        if (activeFilter === 'history') return request.status !== 'pending'
        return true
      })
      .filter((request) => changeMatches(request, search))
  }, [activeFilter, changeRequests, followThrough?.sessions, mode, readiness?.sessions, search])

  const selectedRecord = useMemo(
    () => visibleRecords.find((record) => String(record.id) === String(selectedId)) || visibleRecords[0] || null,
    [selectedId, visibleRecords],
  )

  function changeMode(nextMode) {
    setMode(nextMode)
    setSearch('')
    setSelectedId('')
  }

  function changeFilter(nextFilter) {
    setFilters((current) => ({ ...current, [mode]: nextFilter }))
    setSelectedId('')
  }

  const canManageSessions = teamAccess?.permissions?.sessions === 'manage'

  function setReviewNote(requestId, value) {
    setReviewNotes((current) => ({
      ...current,
      [requestId]: value,
    }))
  }

  function requestBookingStatus(session, targetStatus) {
    const clientName = session.clientName || 'This client'
    const startsAt = formatDateTime(session.startsAt)

    const details = {
      approved: {
        title: `Approve ${clientName}'s session request?`,
        message: `This moves the booking from ${label(session.status)} to Approved.`,
        detail: 'The secured booking workflow will re-evaluate booking communications and may start configured onboarding for a linked client.',
        confirmLabel: 'Approve request',
        tone: 'normal',
      },
      confirmed: {
        title: `Mark ${clientName}'s session confirmed?`,
        message: `This confirms the ${startsAt} session.`,
        detail: 'The secured booking workflow will re-evaluate booking communications and configured onboarding.',
        confirmLabel: 'Mark confirmed',
        tone: 'normal',
      },
      completed: {
        title: `Complete ${clientName}'s session?`,
        message: `This records the ${startsAt} appointment as completed.`,
        detail: 'Use this only after the session has occurred. Existing private booking notes are preserved.',
        confirmLabel: 'Complete session',
        tone: 'normal',
      },
      cancelled: {
        title: `Cancel ${clientName}'s session?`,
        message: `This removes the ${startsAt} appointment from the active session workflow.`,
        detail: 'The booking remains in history. The secured communication workflow will also re-evaluate the session.',
        confirmLabel: 'Cancel session',
        tone: 'danger',
      },
      no_show: {
        title: `Mark ${clientName}'s session as a no-show?`,
        message: `This closes the ${startsAt} appointment as a no-show.`,
        detail: 'Use this only when the appointment was missed. Existing private booking notes are preserved.',
        confirmLabel: 'Mark no-show',
        tone: 'danger',
      },
    }

    const copy = details[targetStatus]
    if (!copy) return

    setConfirmation({
      kind: 'booking',
      session,
      targetStatus,
      ...copy,
    })
  }

  function requestChangeDecision(request, decision) {
    const name = changeClientName(request)
    const approving = decision === 'approved'
    const isCancellation = request.request_type === 'cancel'

    setConfirmation({
      kind: 'change',
      request,
      decision,
      title: approving
        ? `Approve ${name}'s ${isCancellation ? 'cancellation' : 'reschedule'} request?`
        : `Decline ${name}'s ${isCancellation ? 'cancellation' : 'reschedule'} request?`,
      message: approving
        ? isCancellation
          ? 'Approval will cancel the connected booking.'
          : `Approval will move the booking to ${formatDateTime(request.requested_starts_at)}.`
        : 'Declining records the review decision and leaves the current booking unchanged.',
      detail: 'The reviewer identity, decision time, and private reviewer note remain in session history.',
      confirmLabel: approving ? 'Approve request' : 'Decline request',
      tone: approving ? 'normal' : 'danger',
    })
  }

  async function executeConfirmation() {
    if (!confirmation) return

    setError('')
    setMessage('')

    try {
      if (confirmation.kind === 'booking') {
        const session = confirmation.session
        setBusyAction(`booking:${session.id}`)

        await updateAdminBookingStatus(session.id, {
          status: confirmation.targetStatus,
          adminNotes: session.adminNotes || '',
        })

        setConfirmation(null)
        await loadSessions()
        setMessage('Session status updated.')
      } else {
        const request = confirmation.request
        setBusyAction(`change:${request.id}`)

        await reviewAdminSessionChangeRequest(request.id, {
          decision: confirmation.decision,
          reviewerNotes: reviewNotes[request.id] || '',
        })

        setConfirmation(null)
        await loadSessions()
        setMessage('Session change request reviewed.')
      }
    } catch (actionError) {
      setError(actionError.message || 'Unable to update this session.')
    } finally {
      setBusyAction('')
    }
  }

  useEffect(() => {
    if (!confirmation) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape' && !busyAction) {
        setConfirmation(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [busyAction, confirmation])

  const actionContext = {
    busyAction,
    canManageSessions,
    requestBookingStatus,
    requestChangeDecision,
    reviewNotes,
    setReviewNote,
  }

  return (
    <div className="studio-v2-page studio-sessions-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">Requests through follow-through</p>
          <h1>Sessions</h1>
          <p>See what is coming up, what needs preparation, and what requires thoughtful follow-through after the appointment.</p>
        </div>
        <div className="studio-sessions-header-actions">
          <button className="studio-v2-button is-primary" disabled={loading} onClick={() => loadSessions()} type="button">{loading ? 'Refreshing...' : 'Refresh Sessions'}</button>
          <Link className="studio-v2-button is-secondary" to="/admin/scheduler">Legacy Sessions</Link>
        </div>
      </header>

      <aside className="studio-sessions-readonly-note is-protected">
        <strong>{canManageSessions ? 'Protected session actions enabled' : 'Real session data connected'}</strong>
        <span>
          {canManageSessions
            ? 'Booking status changes and client change-request decisions now use the existing secured Sessions APIs.'
            : 'Your current Studio role can review Sessions data but cannot perform protected session actions.'}
        </span>
      </aside>

      {error && <div className="studio-sessions-alert is-error" role="alert">{error}</div>}
      {message && <div className="studio-sessions-alert is-success" role="status">{message}</div>}

      <section className="studio-sessions-metrics" aria-label="Session attention summary">
        <article><span>Upcoming 30 days</span><strong>{readiness?.summary?.total || 0}</strong></article>
        <article><span>Decision needed</span><strong>{readiness?.summary?.decision || 0}</strong></article>
        <article><span>Ready</span><strong>{readiness?.summary?.ready || 0}</strong></article>
        <article><span>Change requests</span><strong>{pendingChanges.length}</strong></article>
        <article><span>Follow-through</span><strong>{followAttention}</strong></article>
      </section>

      <nav className="studio-sessions-mode-switcher" aria-label="Sessions workspace view">
        {modes.map(([value, text]) => (
          <button key={value} type="button" className={mode === value ? 'is-active' : ''} aria-pressed={mode === value} onClick={() => changeMode(value)}>{text}</button>
        ))}
      </nav>

      <section className="studio-sessions-toolbar">
        <label>
          <span>Search sessions</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Client, email, session type, status, or team member" />
        </label>
        <nav aria-label={`${label(mode)} filter`}>
          {modeFilters[mode].map(([value, text]) => (
            <button key={value} type="button" className={activeFilter === value ? 'is-active' : ''} aria-pressed={activeFilter === value} onClick={() => changeFilter(value)}>{text}</button>
          ))}
        </nav>
      </section>

      <div
        className={`studio-sessions-layout${!loading && visibleRecords.length === 0 ? ' is-empty' : ''}`}
      >
        <section className="studio-sessions-directory" aria-label="Session list">
          <header>
            <div><p className="studio-v2-eyebrow">{mode === 'upcoming' ? 'Upcoming sessions' : mode === 'follow-through' ? 'Recent sessions' : 'Client requests'}</p><h2>{visibleRecords.length} shown</h2></div>
            <span>{mode === 'upcoming' ? `${readiness?.horizonDays || 30} day horizon` : mode === 'follow-through' ? `${followThrough?.horizonDays || 30} day history` : `${changeRequests.length} total`}</span>
          </header>
          <div className="studio-sessions-directory-list">
            {loading && !visibleRecords.length ? (
              <div className="studio-sessions-empty">Loading session care...</div>
            ) : mode === 'changes' ? (
              visibleRecords.map((request) => <ChangeCard key={request.id} request={request} selected={request.id === selectedRecord?.id} onSelect={setSelectedId} />)
            ) : (
              visibleRecords.map((session) => <SessionCard key={session.id} mode={mode} session={session} selected={session.id === selectedRecord?.id} onSelect={setSelectedId} />)
            )}
            {!loading && visibleRecords.length === 0 && (
              <div className="studio-sessions-empty"><strong>No sessions match this view.</strong><span>Adjust the filter or search to review another part of the session journey.</span></div>
            )}
          </div>
        </section>

        <section className="studio-session-detail" aria-label="Selected session">
          <SessionsActionContext.Provider value={actionContext}>
          {!selectedRecord ? (
            <div className="studio-sessions-empty is-detail"><strong>No session selected</strong><span>Select a record to review preparation, client context, or follow-through.</span></div>
          ) : mode === 'upcoming' ? (
            <UpcomingDetail session={selectedRecord} />
          ) : mode === 'follow-through' ? (
            <FollowThroughDetail session={selectedRecord} />
          ) : (
            <ChangeDetail request={selectedRecord} />
          )}
          </SessionsActionContext.Provider>
        </section>
      </div>

      <SessionConfirmDialog
        busy={Boolean(busyAction)}
        confirmation={confirmation}
        onCancel={() => {
          if (!busyAction) setConfirmation(null)
        }}
        onConfirm={executeConfirmation}
      />
    </div>
  )
}
