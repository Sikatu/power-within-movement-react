import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'
import {
  getAdminSessionChangeRequests,
  reviewAdminSessionChangeRequest,
} from '../../lib/nativeApi'


const businessTimeZone = 'America/New_York'

function formatDateTime(value) {
  if (!value) return 'Not provided'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: businessTimeZone,
  }).format(new Date(value))
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function clientName(request) {
  return (
    [request.client_first_name, request.client_last_name].filter(Boolean).join(' ') ||
    request.client_email ||
    'Client'
  )
}

export default function AdminSessionChangeRequests() {
  const confirmAction = useAdminConfirm()
  const [requests, setRequests] = useState([])
  const [activeView, setActiveView] = useState('pending')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [notes, setNotes] = useState({})
  const [busyId, setBusyId] = useState('')
  const [status, setStatus] = useState({ loading: true, error: '', message: '' })

  async function loadRequests() {
    try {
      setStatus((current) => ({ ...current, loading: true, error: '' }))
      const response = await getAdminSessionChangeRequests()
      setRequests(response.requests || [])
      setStatus((current) => ({ ...current, loading: false }))
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'Unable to load session changes.', message: '' })
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialRequests() {
      try {
        const response = await getAdminSessionChangeRequests()
        if (!isMounted) return
        setRequests(response.requests || [])
        setStatus({ loading: false, error: '', message: '' })
      } catch (error) {
        if (!isMounted) return
        setStatus({
          loading: false,
          error: error.message || 'Unable to load session changes.',
          message: '',
        })
      }
    }

    loadInitialRequests()

    return () => {
      isMounted = false
    }
  }, [])

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests],
  )

  const historyRequests = useMemo(
    () => requests.filter((request) => request.status !== 'pending'),
    [requests],
  )

  const visibleRequests = activeView === 'pending' ? pendingRequests : historyRequests
  const selectedRequest = visibleRequests.find((request) => request.id === selectedRequestId) || visibleRequests[0] || null

  async function reviewRequest(request, decision) {
    const action = decision === 'approved' ? 'approve' : 'decline'
    const confirmed = await confirmAction({
      title: `${action === 'approve' ? 'Approve' : 'Decline'} this request?`,
      message: `Are you sure you want to ${action} this ${request.request_type} request?`,
      confirmLabel: action === 'approve' ? 'Approve request' : 'Decline request',
      tone: action === 'approve' ? 'warning' : 'danger',
    })

    if (!confirmed) return

    try {
      setBusyId(request.id)
      setStatus((current) => ({ ...current, error: '', message: '' }))
      const response = await reviewAdminSessionChangeRequest(request.id, {
        decision,
        reviewerNotes: notes[request.id] || '',
      })

      setRequests(response.requests || [])
      setStatus({ loading: false, error: '', message: response.message || 'Request reviewed.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'Unable to review this request.', message: '' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <AdminFrame>
      <div className="session-change-admin">
        <header className="session-change-admin__header">
          <div>
            <p className="eyebrow">Sessions</p>
            <h1>Client Change Requests</h1>
            <p>
              Review cancellation and reschedule requests without losing the original session history.
            </p>
          </div>
          <div className="session-change-admin__header-actions">
            <Link className="btn secondary" to="/admin/scheduler">Open Sessions</Link>
            <button className="btn secondary" type="button" onClick={loadRequests} disabled={status.loading}>
              {status.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <section className="session-change-admin__summary" aria-label="Session change summary">
          <article>
            <span>Needs Review</span>
            <strong>{pendingRequests.length}</strong>
          </article>
          <article>
            <span>Reviewed</span>
            <strong>{historyRequests.length}</strong>
          </article>
          <article>
            <span>Total Requests</span>
            <strong>{requests.length}</strong>
          </article>
        </section>

        {(status.error || status.message) && (
          <div
            className={`session-change-admin__notice${status.error ? ' is-error' : ''}`}
            role={status.error ? 'alert' : 'status'}
          >
            {status.error || status.message}
          </div>
        )}

        <div className="session-change-admin__tabs" role="tablist" aria-label="Change request status">
          <button
            id="session-change-tab-pending"
            type="button"
            className={activeView === 'pending' ? 'is-active' : ''}
            role="tab"
            aria-controls="session-change-panel-pending"
            aria-selected={activeView === 'pending'}
            onClick={() => setActiveView('pending')}
          >
            Needs Review <span>{pendingRequests.length}</span>
          </button>
          <button
            id="session-change-tab-history"
            type="button"
            className={activeView === 'history' ? 'is-active' : ''}
            role="tab"
            aria-controls="session-change-panel-history"
            aria-selected={activeView === 'history'}
            onClick={() => setActiveView('history')}
          >
            History <span>{historyRequests.length}</span>
          </button>
        </div>

        <section
          className="session-change-admin__tabpanel"
          id={`session-change-panel-${activeView}`}
          role="tabpanel"
          aria-labelledby={`session-change-tab-${activeView}`}
          tabIndex={0}
        >
          {status.loading ? (
            <div className="session-change-admin__empty">Loading session changes…</div>
        ) : visibleRequests.length === 0 ? (
          <div className="session-change-admin__empty">
            <strong>{activeView === 'pending' ? 'No requests need attention.' : 'No reviewed requests yet.'}</strong>
            <p>
              {activeView === 'pending'
                ? 'New client cancellation or reschedule requests will appear here.'
                : 'Approved and declined requests will remain here for reference.'}
            </p>
          </div>
        ) : selectedRequest && (
          <div className="session-change-admin__workbench">
            <aside className="session-change-admin__queue" aria-label={`${activeView === 'pending' ? 'Requests needing review' : 'Reviewed requests'}`}>
              <header><strong>{activeView === 'pending' ? 'Review queue' : 'Request history'}</strong><span>{visibleRequests.length}</span></header>
              <div>
                {visibleRequests.map((request) => (
                  <button key={request.id} type="button" className={selectedRequest.id === request.id ? 'is-selected' : ''} aria-pressed={selectedRequest.id === request.id} onClick={() => setSelectedRequestId(request.id)}>
                    <span className={`session-change-card__type is-${request.request_type}`}>{request.request_type === 'cancel' ? 'Cancellation' : 'Reschedule'}</span>
                    <strong>{clientName(request)}</strong>
                    <small>{request.request_type === 'reschedule' ? formatDateTime(request.requested_starts_at) : formatDateTime(request.current_starts_at)}</small>
                  </button>
                ))}
              </div>
            </aside>

            <article className="session-change-card session-change-card--focused">
              <div className="session-change-card__topline">
                <div>
                  <span className={`session-change-card__type is-${selectedRequest.request_type}`}>{selectedRequest.request_type === 'cancel' ? 'Cancellation' : 'Reschedule'}</span>
                  <span className={`session-change-card__status is-${selectedRequest.status}`}>{formatLabel(selectedRequest.status)}</span>
                </div>
                <time>{formatDateTime(selectedRequest.created_at)}</time>
              </div>

              <div className="session-change-card__identity">
                <div><p>Client</p><h2>{clientName(selectedRequest)}</h2><span>{selectedRequest.client_email}</span></div>
                <Link to={`/admin/clients/${selectedRequest.client_profile_id}/care`}>Open Client Record</Link>
              </div>

              <div className="session-change-card__details">
                <div><span>Session</span><strong>{selectedRequest.appointment_type_name || 'Private Session'}</strong></div>
                <div><span>Current time</span><strong>{formatDateTime(selectedRequest.current_starts_at)}</strong></div>
                {selectedRequest.request_type === 'reschedule' && <div className="is-requested-time"><span>Requested new time</span><strong>{formatDateTime(selectedRequest.requested_starts_at)}</strong></div>}
              </div>

              <div className="session-change-card__reason"><span>Client’s reason</span><p>{selectedRequest.reason}</p></div>

              {selectedRequest.status === 'pending' ? (
                <div className="session-change-card__review">
                  <label>
                    <span>Private review note (optional)</span>
                    <textarea rows="3" value={notes[selectedRequest.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [selectedRequest.id]: event.target.value }))} placeholder="Add a short internal note about the decision." />
                  </label>
                  <div>
                    <button className="btn primary" type="button" disabled={busyId === selectedRequest.id} onClick={() => reviewRequest(selectedRequest, 'approved')}>{busyId === selectedRequest.id ? 'Saving…' : 'Approve Request'}</button>
                    <button className="btn secondary" type="button" disabled={busyId === selectedRequest.id} onClick={() => reviewRequest(selectedRequest, 'declined')}>Decline</button>
                  </div>
                </div>
              ) : (
                <div className="session-change-card__reviewed"><span>Reviewed by {selectedRequest.reviewer_email || 'Studio team'}</span>{selectedRequest.reviewer_notes && <p>{selectedRequest.reviewer_notes}</p>}</div>
              )}
            </article>
          </div>
        )}
        </section>
      </div>
    </AdminFrame>
  )
}
