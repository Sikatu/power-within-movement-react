import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'
import {
  archiveAdminEncouragement,
  createAdminEncouragement,
  deleteAdminEncouragement,
  getAdminClients,
  getAdminEncouragements,
  publishAdminEncouragement,
  updateAdminEncouragement,
} from '../../lib/nativeApi'


const BUSINESS_TIME_ZONE = 'America/New_York'

const emptyForm = {
  title: '',
  body: '',
  messageType: 'encouragement',
  visibility: 'all_members',
  clientProfileId: '',
  deliveryMode: 'draft',
  scheduledDate: '',
  scheduledTime: '09:00',
}

const messageTypeOptions = [
  {
    id: 'encouragement',
    label: 'Encouragement',
    description: 'A warm, steady note for a client’s day.',
  },
  {
    id: 'announcement',
    label: 'Portal announcement',
    description: 'A clear update clients should notice and remember.',
  },
]

function messageTypeCopy(value) {
  return value === 'announcement'
    ? {
        singular: 'announcement',
        titlePlaceholder: 'A helpful update from Power Within',
        bodyPlaceholder: 'Share the update, what it means, and any next step…',
      }
    : {
        singular: 'encouragement',
        titlePlaceholder: 'A small reminder for today',
        bodyPlaceholder: 'Write something steadying, personal, and clear…',
      }
}

function clientName(client) {
  return (
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ||
    client?.email ||
    'Client'
  )
}

function formatStatus(value) {
  const labels = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    published: 'Live',
    archived: 'Archived',
  }

  return labels[value] || 'Draft'
}

function formatDateTime(value) {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function getDateTimeParts(value) {
  if (!value) return { date: '', time: '09:00' }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value))

    const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return {
      date: `${mapped.year}-${mapped.month}-${mapped.day}`,
      time: `${mapped.hour}:${mapped.minute}`,
    }
  } catch {
    return { date: '', time: '09:00' }
  }
}

function getDeliveryMode(post) {
  if (post?.status === 'published') return 'publish_now'
  if (post?.status === 'scheduled') return 'schedule'
  return 'draft'
}

function getAudienceLabel(post) {
  if (post.visibility === 'all_members') return 'All active clients'

  return (
    [post.client_first_name, post.client_last_name].filter(Boolean).join(' ') ||
    post.client_email ||
    'One client'
  )
}

function metricValue(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function AdminEncouragements() {
  const [searchParams, setSearchParams] = useSearchParams()
  const confirmAction = useAdminConfirm()
  const composerRef = useRef(null)
  const [clients, setClients] = useState([])
  const [encouragements, setEncouragements] = useState([])
  const [metrics, setMetrics] = useState({})
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    messageType:
      searchParams.get('type') === 'announcement' ? 'announcement' : 'encouragement',
  }))
  const [editingId, setEditingId] = useState('')
  const [workspaceView, setWorkspaceView] = useState(
    searchParams.get('view') === 'compose' ? 'compose' : 'library',
  )
  const [filters, setFilters] = useState({
    status: 'all',
    visibility: 'all',
    messageType: 'all',
    search: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientProfileId) || null,
    [clients, form.clientProfileId],
  )

  async function loadEncouragements(nextFilters = filters) {
    setIsLoading(true)
    setError('')

    try {
      const response = await getAdminEncouragements(nextFilters)
      setEncouragements(response.encouragements || [])
      setMetrics(response.metrics || {})
      setFeatureEnabled(response.featureEnabled !== false)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load client messages.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadClients() {
    try {
      const response = await getAdminClients()
      setClients(response.clients || [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the client list.')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadClients()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadEncouragements(filters)
    }, filters.search ? 250 : 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.visibility, filters.messageType, filters.search])

  function updateForm(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'visibility' && value === 'all_members'
        ? { clientProfileId: '' }
        : {}),
    }))
    setNotice('')
    setError('')
  }

  function resetComposer(messageType = 'encouragement') {
    setEditingId('')
    setForm({ ...emptyForm, messageType })
    setNotice('')
    setError('')
  }

  function startNewEncouragement(messageType = 'encouragement') {
    resetComposer(messageType)
    setWorkspaceView('compose')
    setSearchParams({ view: 'compose', type: messageType })
  }

  function editEncouragement(post) {
    const scheduleParts = getDateTimeParts(post.scheduled_at)

    setEditingId(post.id)
    setForm({
      title: post.title || '',
      body: post.body || '',
      messageType: post.message_type || 'encouragement',
      visibility: post.visibility || 'all_members',
      clientProfileId: post.client_profile_id || '',
      deliveryMode: getDeliveryMode(post),
      scheduledDate: scheduleParts.date,
      scheduledTime: scheduleParts.time,
    })
    setNotice(`Editing this ${messageTypeCopy(post.message_type).singular}. Save when it is ready.`)
    setError('')
    setWorkspaceView('compose')
    setSearchParams({ view: 'compose', type: post.message_type || 'encouragement' })

    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  function validateForm() {
    if (!form.body.trim()) return `Write the ${messageTypeCopy(form.messageType).singular} before saving.`

    if (form.visibility === 'single_client' && !form.clientProfileId) {
      return 'Choose the client who should receive this message.'
    }

    if (
      form.deliveryMode === 'schedule' &&
      (!form.scheduledDate || !form.scheduledTime)
    ) {
      return 'Choose both a date and time for the scheduled message.'
    }

    return ''
  }

  async function saveEncouragement(event) {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        clientProfileId:
          form.visibility === 'single_client' ? form.clientProfileId : null,
      }

      if (editingId) {
        await updateAdminEncouragement(editingId, payload)
      } else {
        await createAdminEncouragement(payload)
      }

      const deliveryNotice = {
        draft: 'saved as a draft',
        publish_now: featureEnabled
          ? 'published to the Client Portal'
          : 'published, but Client Messages are currently disabled in Developer Controls',
        schedule: 'scheduled in Eastern Time',
      }

      const savedType = messageTypeCopy(form.messageType).singular
      setNotice(`${savedType[0].toUpperCase()}${savedType.slice(1)} ${deliveryNotice[form.deliveryMode] || 'saved'}.`)
      setEditingId('')
      setForm(emptyForm)
      await loadEncouragements(filters)
      setWorkspaceView('library')
      setSearchParams({})
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this client message.')
    } finally {
      setIsSaving(false)
    }
  }

  async function publishNow(post) {
    const messageLabel = messageTypeCopy(post.message_type).singular
    if (!(await confirmAction({
      title: `Publish this ${messageLabel}?`,
      message: `Publish this ${messageLabel} to the Client Portal now?`,
      confirmLabel: 'Publish now',
      tone: 'warning',
    }))) return

    setBusyId(post.id)
    setNotice('')
    setError('')

    try {
      await publishAdminEncouragement(post.id)
      setNotice(
        featureEnabled
          ? `The ${messageLabel} is now live in the Client Portal.`
          : `The ${messageLabel} is published, but Client Messages are disabled in Developer Controls.`,
      )
      await loadEncouragements(filters)
    } catch (actionError) {
      setError(actionError.message || 'Unable to publish this client message.')
    } finally {
      setBusyId('')
    }
  }

  async function archivePost(post) {
    const messageLabel = messageTypeCopy(post.message_type).singular
    if (!(await confirmAction({
      title: `Archive this ${messageLabel}?`,
      message: `This ${messageLabel} will be removed from client view.`,
      confirmLabel: `Archive ${messageLabel}`,
      tone: 'warning',
    }))) return

    setBusyId(post.id)
    setNotice('')
    setError('')

    try {
      await archiveAdminEncouragement(post.id)
      setNotice(`The ${messageLabel} was archived and removed from client view.`)
      await loadEncouragements(filters)
    } catch (actionError) {
      setError(actionError.message || 'Unable to archive this client message.')
    } finally {
      setBusyId('')
    }
  }

  async function deletePost(post) {
    const messageLabel = messageTypeCopy(post.message_type).singular
    if (!(await confirmAction({
      title: `Delete this ${messageLabel} permanently?`,
      message: `This draft or archived ${messageLabel} cannot be restored after deletion.`,
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    }))) return

    setBusyId(post.id)
    setNotice('')
    setError('')

    try {
      await deleteAdminEncouragement(post.id)
      if (editingId === post.id) resetComposer(post.message_type)
      setNotice(`The ${messageLabel} was permanently deleted.`)
      await loadEncouragements(filters)
    } catch (actionError) {
      setError(actionError.message || 'Unable to delete this client message.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <AdminFrame>
      <div className="encouragement-studio">
        <header className="encouragement-studio__header">
          <div>
            <p className="eyebrow">Client Communication</p>
            <h1>Client Messages</h1>
            <p>Share a warm encouragement or a clear portal announcement without leaving one calm workspace.</p>
          </div>

          <button className="btn primary" type="button" onClick={() => startNewEncouragement('encouragement')}>
            Write a message
          </button>
        </header>

        {!featureEnabled && (
          <div className="encouragement-studio__feature-warning" role="status">
            <strong>Client Messages are currently hidden.</strong>
            <span>
              You can prepare drafts and scheduled notes, but clients will not see them
              until Client Messages is enabled in Developer Control Center.
            </span>
          </div>
        )}

        {notice && <div className="encouragement-studio__notice" role="status">{notice}</div>}
        {error && <div className="encouragement-studio__error" role="alert">{error}</div>}

        <section className="encouragement-studio__metrics" aria-label="Client message summary">
          <article>
            <span>Drafts</span>
            <strong>{metricValue(metrics.drafts)}</strong>
          </article>
          <article>
            <span>Scheduled</span>
            <strong>{metricValue(metrics.scheduled)}</strong>
          </article>
          <article>
            <span>Live</span>
            <strong>{metricValue(metrics.published)}</strong>
          </article>
          <article>
            <span>Client reads</span>
            <strong>{metricValue(metrics.total_reads)}</strong>
          </article>
        </section>

        <nav className="onboarding-studio-tabs" aria-label="Client message workspace">
          <button className={workspaceView === 'library' ? 'is-active' : ''} onClick={() => { setWorkspaceView('library'); setSearchParams({}) }} type="button">
            Messages ({encouragements.length})
          </button>
          <button className={workspaceView === 'compose' ? 'is-active' : ''} onClick={() => { setWorkspaceView('compose'); setSearchParams({ view: 'compose', type: form.messageType }) }} type="button">
            {editingId ? 'Edit message' : 'Compose'}
          </button>
        </nav>

        <section className="encouragement-studio__workspace" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {workspaceView === 'compose' && (
          <form
            className="encouragement-composer"
            onSubmit={saveEncouragement}
            ref={composerRef}
          >
            <div className="encouragement-composer__heading">
              <div>
                <p className="eyebrow">{editingId ? 'Editing' : 'Create'}</p>
                <h2>{editingId ? 'Refine this message' : 'Write a client message'}</h2>
              </div>
              {editingId && (
                <button className="btn text" type="button" onClick={() => resetComposer(form.messageType)}>
                  Cancel editing
                </button>
              )}
            </div>

            <fieldset className="encouragement-composer__delivery encouragement-composer__types">
              <legend>What kind of message is this?</legend>
              {messageTypeOptions.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="messageType"
                    value={option.id}
                    checked={form.messageType === option.id}
                    onChange={updateForm}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <label>
              <span>Title <small>optional</small></span>
              <input
                name="title"
                type="text"
                maxLength="160"
                placeholder={messageTypeCopy(form.messageType).titlePlaceholder}
                value={form.title}
                onChange={updateForm}
              />
            </label>

            <label>
              <span>Who should receive this?</span>
              <select name="visibility" value={form.visibility} onChange={updateForm}>
                <option value="all_members">All active clients</option>
                <option value="single_client">One client only</option>
              </select>
            </label>

            {form.visibility === 'single_client' && (
              <label>
                <span>Choose the client</span>
                <select
                  name="clientProfileId"
                  value={form.clientProfileId}
                  onChange={updateForm}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {clientName(client)}{client.email ? ` — ${client.email}` : ''}
                    </option>
                  ))}
                </select>
                {selectedClient && (
                  <small className="encouragement-composer__helper">
                    This note will appear only in {clientName(selectedClient)}’s portal.
                  </small>
                )}
              </label>
            )}

            <label>
              <span>Your message</span>
              <textarea
                name="body"
                rows="10"
                maxLength="10000"
                placeholder={messageTypeCopy(form.messageType).bodyPlaceholder}
                value={form.body}
                onChange={updateForm}
              />
              <small className="encouragement-composer__counter">
                {form.body.length.toLocaleString()} / 10,000
              </small>
            </label>

            <fieldset className="encouragement-composer__delivery">
              <legend>When should clients receive it?</legend>

              <label>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="draft"
                  checked={form.deliveryMode === 'draft'}
                  onChange={updateForm}
                />
                <span><strong>Save as draft</strong><small>Keep working before anyone sees it.</small></span>
              </label>

              <label>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="publish_now"
                  checked={form.deliveryMode === 'publish_now'}
                  onChange={updateForm}
                />
                <span><strong>Publish now</strong><small>Make it available in the Client Portal immediately.</small></span>
              </label>

              <label>
                <input
                  type="radio"
                  name="deliveryMode"
                  value="schedule"
                  checked={form.deliveryMode === 'schedule'}
                  onChange={updateForm}
                />
                <span><strong>Schedule for later</strong><small>Use the business schedule in Eastern Time.</small></span>
              </label>
            </fieldset>

            {form.deliveryMode === 'schedule' && (
              <div className="encouragement-composer__schedule">
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="scheduledDate"
                    value={form.scheduledDate}
                    onChange={updateForm}
                  />
                </label>
                <label>
                  <span>Time</span>
                  <input
                    type="time"
                    name="scheduledTime"
                    value={form.scheduledTime}
                    onChange={updateForm}
                  />
                </label>
                <p>Scheduled times are interpreted in Eastern Time.</p>
              </div>
            )}

            <button className="btn primary encouragement-composer__save" type="submit" disabled={isSaving}>
              {isSaving
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : form.deliveryMode === 'publish_now'
                    ? `Publish ${messageTypeCopy(form.messageType).singular}`
                    : form.deliveryMode === 'schedule'
                      ? `Schedule ${messageTypeCopy(form.messageType).singular}`
                      : 'Save draft'}
            </button>
          </form>
          )}

          {workspaceView === 'library' && (
          <section className="encouragement-library">
            <div className="encouragement-library__heading">
              <div>
                <p className="eyebrow">Message Library</p>
                <h2>Prepared and published notes</h2>
              </div>
              <button className="btn secondary" type="button" onClick={() => loadEncouragements(filters)} disabled={isLoading}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="encouragement-library__filters">
              <label>
                <span>Message type</span>
                <select
                  value={filters.messageType}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, messageType: event.target.value }))
                  }
                >
                  <option value="all">All messages</option>
                  <option value="encouragement">Encouragements</option>
                  <option value="announcement">Announcements</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Drafts</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Live</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label>
                <span>Audience</span>
                <select
                  value={filters.visibility}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, visibility: event.target.value }))
                  }
                >
                  <option value="all">Everyone and private</option>
                  <option value="all_members">All clients</option>
                  <option value="single_client">One client</option>
                </select>
              </label>

              <label className="encouragement-library__search">
                <span>Search</span>
                <input
                  type="search"
                  placeholder="Title, message, or client"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </label>
            </div>

            {isLoading ? (
              <div className="encouragement-library__empty">Loading client messages…</div>
            ) : encouragements.length === 0 ? (
              <div className="encouragement-library__empty">
                <strong>No client messages match these filters.</strong>
                <span>Write a message or change the filters above.</span>
              </div>
            ) : (
              <div className="encouragement-library__list">
                {encouragements.map((post) => (
                  <article className="encouragement-card" key={post.id}>
                    <header>
                      <div>
                        <span className={`encouragement-card__status is-${post.status}`}>
                          {formatStatus(post.status)}
                        </span>
                        <span className={`encouragement-card__audience encouragement-card__type is-${post.message_type || 'encouragement'}`}>
                          {post.message_type === 'announcement' ? 'Announcement' : 'Encouragement'}
                        </span>
                        <span className="encouragement-card__audience">{getAudienceLabel(post)}</span>
                      </div>
                      <small>
                        {post.status === 'scheduled'
                          ? `Scheduled ${formatDateTime(post.scheduled_at)}`
                          : post.status === 'published'
                            ? `Published ${formatDateTime(post.published_at || post.created_at)}`
                            : `Updated ${formatDateTime(post.updated_at)}`}
                      </small>
                    </header>

                    <h3>{post.title || (post.message_type === 'announcement' ? 'An update from Power Within' : 'A note for you')}</h3>
                    <p className="encouragement-card__body">{post.body}</p>

                    <div className="encouragement-card__insight">
                      <span>Audience: {metricValue(post.audience_count)}</span>
                      <span>Read: {metricValue(post.read_count)}</span>
                    </div>

                    <footer>
                      <button className="btn secondary" type="button" onClick={() => editEncouragement(post)} disabled={busyId === post.id}>
                        Edit
                      </button>

                      {post.status !== 'published' && (
                        <button className="btn primary" type="button" onClick={() => publishNow(post)} disabled={busyId === post.id}>
                          Publish now
                        </button>
                      )}

                      {post.status !== 'archived' && (
                        <button className="btn secondary" type="button" onClick={() => archivePost(post)} disabled={busyId === post.id}>
                          Archive
                        </button>
                      )}

                      {['draft', 'archived'].includes(post.status) && (
                        <button className="btn text encouragement-card__delete" type="button" onClick={() => deletePost(post)} disabled={busyId === post.id}>
                          Delete
                        </button>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
          )}
        </section>
      </div>
    </AdminFrame>
  )
}
