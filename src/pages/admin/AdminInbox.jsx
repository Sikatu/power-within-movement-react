import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import './AdminInboxComfort.css'
import {
  createAdminInboxConversation,
  getAdminInbox,
  getAdminInboxConversation,
  sendAdminInboxMessage,
  updateAdminInboxConversation,
} from '../../lib/nativeApi'


const emptyNewConversation = {
  clientProfileId: '',
  subject: '',
  body: '',
  priority: 'normal',
  assignedUserId: '',
  attachmentUrl: '',
  attachmentLabel: '',
}

const emptyReply = {
  body: '',
  attachmentUrl: '',
  attachmentLabel: '',
  isInternalNote: false,
}

function readable(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function clientName(conversation) {
  return (
    [conversation?.first_name, conversation?.last_name].filter(Boolean).join(' ') ||
    conversation?.client_email ||
    'Client'
  )
}

export default function AdminInbox() {
  const [searchParams] = useSearchParams()
  const requestedConversationId = searchParams.get('conversation') || ''
  const [conversations, setConversations] = useState([])
  const [clients, setClients] = useState([])
  const [teamUsers, setTeamUsers] = useState([])
  const [metrics, setMetrics] = useState({})
  const [selectedId, setSelectedId] = useState(requestedConversationId)
  const selectedIdRef = useRef(requestedConversationId)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', search: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newConversation, setNewConversation] = useState(emptyNewConversation)
  const [reply, setReply] = useState(emptyReply)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const replyTextareaRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadConversation = useCallback(async (conversationId) => {
    if (!conversationId) {
      setSelectedConversation(null)
      return
    }

    const result = await getAdminInboxConversation(conversationId)
    setSelectedConversation(result.conversation || null)
  }, [])

  const loadInbox = useCallback(async (preferredId = '') => {
    const result = await getAdminInbox(filters)
    const nextConversations = result.conversations || []
    setConversations(nextConversations)
    setClients(result.clients || [])
    setTeamUsers(result.teamUsers || [])
    setMetrics(result.metrics || {})

    const currentSelectedId = selectedIdRef.current
    const nextId =
      preferredId && nextConversations.some((item) => item.id === preferredId)
        ? preferredId
        : currentSelectedId && nextConversations.some((item) => item.id === currentSelectedId)
          ? currentSelectedId
          : nextConversations[0]?.id || ''

    selectedIdRef.current = nextId
    setSelectedId(nextId)
    await loadConversation(nextId)
  }, [filters, loadConversation])

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setLoading(true)
        await loadInbox(requestedConversationId)
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'The private inbox could not load.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    start()
    return () => {
      mounted = false
    }
  }, [loadInbox, requestedConversationId])

  const filteredCountLabel = useMemo(() => {
    if (filters.status === 'all' && filters.priority === 'all' && !filters.search.trim()) {
      return `${conversations.length} conversations`
    }
    return `${conversations.length} matching conversations`
  }, [conversations.length, filters])

  const activeFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
  ].filter(Boolean).length

  function resetFilters() {
    setFilters({ status: 'all', priority: 'all', search: '' })
    setShowFilters(false)
  }

  async function perform(action, successMessage, preferredId = selectedId) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await action()
      setNotice(result?.message || successMessage)
      await loadInbox(preferredId || result?.conversation?.id || '')
      return result
    } catch (actionError) {
      setError(actionError.message || 'The private inbox could not save that change.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function openConversation(conversationId) {
    selectedIdRef.current = conversationId
    setSelectedId(conversationId)
    setError('')
    setNotice('')
    try {
      await loadConversation(conversationId)
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? { ...item, unread_team_count: 0 } : item,
        ),
      )
    } catch (loadError) {
      setError(loadError.message || 'This conversation could not open.')
    }
  }

  async function createConversation(event) {
    event.preventDefault()
    const result = await perform(
      () => createAdminInboxConversation({
        ...newConversation,
        assignedUserId: newConversation.assignedUserId || null,
      }),
      'Private client conversation created.',
      '',
    )

    if (result?.conversation) {
      setNewConversation(emptyNewConversation)
      setShowNew(false)
      selectedIdRef.current = result.conversation.id
      setSelectedId(result.conversation.id)
      setSelectedConversation(result.conversation)
    }
  }

  function openReplyComposer() {
    setComposerExpanded(true)

    window.requestAnimationFrame(() => {
      replyTextareaRef.current?.focus({ preventScroll: true })
    })
  }

  function minimizeReplyComposer() {
    if (!busy) setComposerExpanded(false)
  }

  async function sendReply(event) {
    event.preventDefault()
    if (!selectedConversation) return

    const result = await perform(
      () => sendAdminInboxMessage(selectedConversation.id, reply),
      reply.isInternalNote ? 'Internal note added.' : 'Reply sent.',
      selectedConversation.id,
    )

    if (result) {
      setReply(emptyReply)
      setComposerExpanded(false)
    }
  }

  async function updateConversation(changes) {
    if (!selectedConversation) return
    const result = await perform(
      () => updateAdminInboxConversation(selectedConversation.id, changes),
      'Conversation updated.',
      selectedConversation.id,
    )
    if (result?.conversation) setSelectedConversation(result.conversation)
  }

  return (
    <AdminFrame>
      <div className="admin-inbox">
        <header className="admin-inbox__header">
          <div>
            <p className="eyebrow">Private Client Care</p>
            <h1>Inbox</h1>
            <p>
              Reply to clients, leave private team notes, and keep every conversation moving.
            </p>
          </div>
          <div className="admin-inbox__header-actions">
            <button className="btn primary" type="button" onClick={() => setShowNew(true)}>
              New Message
            </button>
            <button className="btn secondary" type="button" disabled={loading} onClick={() => loadInbox()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        <section className="admin-inbox__metrics" aria-label="Inbox summary">
          <button type="button" onClick={() => setFilters((current) => ({ ...current, status: 'open' }))}>
            <span>Open</span><strong>{Number(metrics.active || 0)}</strong>
          </button>
          <button className="is-attention" type="button" onClick={() => setFilters((current) => ({ ...current, status: 'waiting_on_team' }))}>
            <span>Needs Reply</span><strong>{Number(metrics.waiting_on_team || 0)}</strong>
          </button>
          <article><span>Unread</span><strong>{Number(metrics.unread || 0)}</strong></article>
          <article className="is-urgent"><span>Urgent</span><strong>{Number(metrics.urgent || 0)}</strong></article>
        </section>

        {(error || notice) && (
          <div
            className={`admin-inbox__notice${error ? ' is-error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <section className="admin-inbox__toolbar" aria-label="Find conversations">
          <label className="admin-inbox__search">
            <span className="sr-only">Search conversations</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search client, email, or subject"
            />
          </label>
          <button
            className={`btn secondary${showFilters ? ' is-active' : ''}`}
            type="button"
            aria-expanded={showFilters}
            aria-controls="inbox-advanced-filters"
            onClick={() => setShowFilters((current) => !current)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {(activeFilterCount > 0 || filters.search.trim()) && (
            <button className="btn secondary" type="button" onClick={resetFilters}>
              Reset
            </button>
          )}
        </section>

        {showFilters && (
        <section id="inbox-advanced-filters" className="admin-inbox__filters" aria-label="Inbox filters">
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">All statuses</option>
              <option value="waiting_on_team">Needs team reply</option>
              <option value="waiting_on_client">Waiting on client</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </label>
        </section>
        )}

        <p className="admin-inbox__count">{filteredCountLabel}</p>

        <div className="admin-inbox__workspace" aria-busy={loading}>
          <aside className="admin-inbox__list" aria-label="Client conversations">
            {loading ? (
              <div className="admin-inbox__empty">Loading private conversations…</div>
            ) : conversations.length === 0 ? (
              <div className="admin-inbox__empty">
                <strong>No conversations yet.</strong>
                <p>Start a private message or wait for a client to contact Power Within.</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`admin-inbox-list-item${selectedId === conversation.id ? ' is-active' : ''}`}
                  aria-pressed={selectedId === conversation.id}
                  onClick={() => openConversation(conversation.id)}
                >
                  <div className="admin-inbox-list-item__top">
                    <strong>{clientName(conversation)}</strong>
                    {Number(conversation.unread_team_count || 0) > 0 && (
                      <span>{conversation.unread_team_count}</span>
                    )}
                  </div>
                  <h2>{conversation.subject}</h2>
                  <p>{conversation.latest_message || 'No visible message yet.'}</p>
                  <div>
                    <em className={`is-${conversation.priority}`}>{readable(conversation.priority)}</em>
                    <em>{readable(conversation.status)}</em>
                    <time>{formatDateTime(conversation.last_message_at)}</time>
                  </div>
                </button>
              ))
            )}
          </aside>

          <section className="admin-inbox__thread">
            {!selectedConversation ? (
              <div className="admin-inbox__empty is-large">
                <strong>Select a conversation.</strong>
                <p>Client messages and internal notes will appear here.</p>
              </div>
            ) : (
              <>
                <header className="admin-inbox-thread__header">
                  <div>
                    <p>{clientName(selectedConversation)}</p>
                    <h2>{selectedConversation.subject}</h2>
                    {selectedConversation.client_profile_id ? (
                      <Link to={`/admin/clients/${selectedConversation.client_profile_id}/communication`}>
                        Open Client Communication Record
                      </Link>
                    ) : (
                      <span>
                        {selectedConversation.channel === 'email'
                          ? 'External email conversation'
                          : 'Subscriber conversation'}
                      </span>
                    )}
                  </div>
                  <div className="admin-inbox-thread__controls">
                    <label>
                      <span>Priority</span>
                      <select
                        value={selectedConversation.priority}
                        onChange={(event) => updateConversation({ priority: event.target.value })}
                        disabled={busy}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                    <label>
                      <span>Assigned to</span>
                      <select
                        value={selectedConversation.assigned_user_id || ''}
                        onChange={(event) => updateConversation({ assignedUserId: event.target.value || null })}
                        disabled={busy}
                      >
                        <option value="">Unassigned</option>
                        {teamUsers.map((user) => (
                          <option key={user.id} value={user.id}>{user.email} · {readable(user.role)}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => updateConversation({ status: selectedConversation.status === 'closed' ? 'open' : 'closed' })}
                    >
                      {selectedConversation.status === 'closed' ? 'Reopen' : 'Close'}
                    </button>
                  </div>
                </header>

                <div className="admin-inbox-thread__messages" aria-live="polite">
                  {(selectedConversation.messages || []).map((message) => (
                    <article
                      key={message.id}
                      className={`admin-inbox-message is-${message.sender_role}${message.is_internal_note ? ' is-internal' : ''}`}
                    >
                      <div>
                        <strong>{message.is_internal_note ? 'Internal Team Note' : message.sender_name}</strong>
                        <time>{formatDateTime(message.created_at)}</time>
                      </div>
                      <p>{message.body}</p>
                      {message.attachment_url && (
                        <a href={message.attachment_url} target="_blank" rel="noreferrer">
                          {message.attachment_label || 'Open attachment'}
                        </a>
                      )}
                    </article>
                  ))}
                </div>

                <form
                  className={`admin-inbox-reply${composerExpanded ? ' is-expanded' : ' is-collapsed'}`}
                  onSubmit={sendReply}
                >
                  <div className="admin-inbox-reply__dock">
                    {!composerExpanded && (
                      <button
                        className="admin-inbox-reply__preview"
                        type="button"
                        onClick={openReplyComposer}
                      >
                        <span>{reply.body.trim() || 'Write a reply or private note???'}</span>
                        {(reply.body.trim() || reply.attachmentUrl.trim()) && (
                          <strong>Draft saved</strong>
                        )}
                      </button>
                    )}
                    <button
                      className="admin-inbox-reply__toggle"
                      type="button"
                      aria-expanded={composerExpanded}
                      disabled={busy}
                      onClick={composerExpanded ? minimizeReplyComposer : openReplyComposer}
                    >
                      {composerExpanded ? 'Minimize' : 'Expand'}
                    </button>
                  </div>
                  {composerExpanded && (
                    <>
                  {selectedConversation.channel === 'email' && !reply.isInternalNote && (
                    <div className="admin-inbox__notice" role="status">
                      This response will be sent by email and kept in the same conversation thread.
                    </div>
                  )}
                  <div className="admin-inbox-reply__mode">
                    <button
                      type="button"
                      className={!reply.isInternalNote ? 'is-active' : ''}
                      aria-pressed={!reply.isInternalNote}
                      onClick={() => setReply((current) => ({ ...current, isInternalNote: false }))}
                    >
                      Reply to Client
                    </button>
                    <button
                      type="button"
                      className={reply.isInternalNote ? 'is-active' : ''}
                      aria-pressed={reply.isInternalNote}
                      onClick={() => setReply((current) => ({ ...current, isInternalNote: true }))}
                    >
                      Internal Note
                    </button>
                  </div>
                  <label>
                    <span>{reply.isInternalNote ? 'Private team note' : 'Message'}</span>
                    <textarea
                      ref={replyTextareaRef}
                      rows="5"
                      value={reply.body}
                      onChange={(event) => setReply((current) => ({ ...current, body: event.target.value }))}
                      placeholder={reply.isInternalNote ? 'Only Studio team members can see this note.' : 'Write a warm, clear reply to the client.'}
                      required
                    />
                  </label>
                  <div className="admin-inbox-reply__attachments">
                    <label>
                      <span>Attachment link (optional)</span>
                      <input type="url" value={reply.attachmentUrl} onChange={(event) => setReply((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" />
                    </label>
                    <label>
                      <span>Link label</span>
                      <input value={reply.attachmentLabel} onChange={(event) => setReply((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="Open worksheet" />
                    </label>
                  </div>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={busy || !reply.body.trim()}
                  >
                    {busy ? (reply.isInternalNote ? 'Saving…' : 'Sending…') : reply.isInternalNote ? 'Add Internal Note' : 'Send Reply'}
                  </button>
                    </>
                  )}
                </form>
              </>
            )}
          </section>
        </div>

        {showNew && (
          <div className="admin-inbox-modal" role="dialog" aria-modal="true" aria-label="New client message">
            <form onSubmit={createConversation}>
              <header>
                <div>
                  <p className="eyebrow">New Private Conversation</p>
                  <h2>Message a client</h2>
                </div>
                <button type="button" onClick={() => setShowNew(false)} aria-label="Close">×</button>
              </header>
              <label>
                <span>Client</span>
                <select value={newConversation.clientProfileId} onChange={(event) => setNewConversation((current) => ({ ...current, clientProfileId: event.target.value }))} required>
                  <option value="">Choose a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.email} · {client.email || 'No portal email'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-inbox-modal__row">
                <label>
                  <span>Priority</span>
                  <select value={newConversation.priority} onChange={(event) => setNewConversation((current) => ({ ...current, priority: event.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label>
                  <span>Assign to</span>
                  <select value={newConversation.assignedUserId} onChange={(event) => setNewConversation((current) => ({ ...current, assignedUserId: event.target.value }))}>
                    <option value="">Assign to me automatically</option>
                    {teamUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.email} · {readable(user.role)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Subject</span>
                <input value={newConversation.subject} onChange={(event) => setNewConversation((current) => ({ ...current, subject: event.target.value }))} placeholder="A clear reason for the message" required />
              </label>
              <label>
                <span>Message</span>
                <textarea rows="7" value={newConversation.body} onChange={(event) => setNewConversation((current) => ({ ...current, body: event.target.value }))} placeholder="Write the private message the client will see." required />
              </label>
              <div className="admin-inbox-modal__row">
                <label>
                  <span>Attachment link (optional)</span>
                  <input type="url" value={newConversation.attachmentUrl} onChange={(event) => setNewConversation((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" />
                </label>
                <label>
                  <span>Link label</span>
                  <input value={newConversation.attachmentLabel} onChange={(event) => setNewConversation((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="Open resource" />
                </label>
              </div>
              <footer>
                <button className="btn secondary" type="button" onClick={() => setShowNew(false)}>Cancel</button>
                <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Start Conversation'}</button>
              </footer>
            </form>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
