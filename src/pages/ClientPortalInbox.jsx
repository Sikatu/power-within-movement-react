import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  createClientPortalInboxConversation,
  getClientPortalDashboard,
  getClientPortalInbox,
  getClientPortalInboxConversation,
  getClientPortalMessages,
  logoutClientPortal,
  markClientPortalMessageRead,
  sendClientPortalInboxMessage,
  updateClientPortalInboxConversation,
} from '../lib/nativeApi'

import './ClientPortal.css'
import './ClientPortalInbox.css'

const portalSections = [
  ['Home', '/client-portal/home'],
  ['Journey', '/client-portal/journey'],
  ['Resources', '/client-portal/resources'],
  ['Learning', '/client-portal/learning'],
  ['Membership', '/client-portal/membership'],
  ['The Circle', '/client-portal/circle'],
  ['Sessions', '/client-portal/sessions'],
  ['Messages', '/client-portal/messages'],
  ['Profile', '/client-portal/profile'],
]

const emptyMessage = {
  subject: '',
  body: '',
  attachmentUrl: '',
  attachmentLabel: '',
}

const emptyReply = {
  body: '',
  attachmentUrl: '',
  attachmentLabel: '',
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

export default function ClientPortalInbox() {
  const navigate = useNavigate()
  const { conversationId = '' } = useParams()
  const [client, setClient] = useState(null)
  const [conversations, setConversations] = useState([])
  const [conversation, setConversation] = useState(null)
  const [encouragements, setEncouragements] = useState([])
  const [encouragementUnread, setEncouragementUnread] = useState(0)
  const [inboxUnread, setInboxUnread] = useState(0)
  const [activeTab, setActiveTab] = useState('inbox')
  const [showNew, setShowNew] = useState(false)
  const [newMessage, setNewMessage] = useState(emptyMessage)
  const [reply, setReply] = useState(emptyReply)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.body.classList.add('client-portal-mode')
    return () => document.body.classList.remove('client-portal-mode')
  }, [])

  const loadConversation = useCallback(async (id) => {
    if (!id) {
      setConversation(null)
      return
    }
    const result = await getClientPortalInboxConversation(id)
    setConversation(result.conversation || null)
    setConversations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, unread_client_count: 0 } : item,
      ),
    )
  }, [])

  const loadPage = useCallback(async () => {
    const [dashboardResult, inboxResult, messageResult] = await Promise.all([
      getClientPortalDashboard(),
      getClientPortalInbox(),
      getClientPortalMessages().catch(() => ({ messages: [], unreadCount: 0 })),
    ])

    setClient(dashboardResult.client || null)
    setConversations(inboxResult.conversations || [])
    setInboxUnread(Number(inboxResult.unreadCount || 0))
    setEncouragements(messageResult.messages || [])
    setEncouragementUnread(Number(messageResult.unreadCount || 0))

    const preferredId = conversationId || inboxResult.conversations?.[0]?.id || ''
    if (preferredId) await loadConversation(preferredId)
    else setConversation(null)
  }, [conversationId, loadConversation])

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setLoading(true)
        await loadPage()
      } catch (loadError) {
        if (!mounted) return
        const message = loadError.message || 'Your private messages could not open.'
        setError(message)
        if (/login required|unauthorized|401/i.test(message)) {
          navigate('/client-portal/login', { replace: true })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    start()
    return () => {
      mounted = false
    }
  }, [loadPage, navigate])

  const totalUnread = inboxUnread + encouragementUnread
  const openConversations = useMemo(
    () => conversations.filter((item) => item.status !== 'closed'),
    [conversations],
  )
  const closedConversations = useMemo(
    () => conversations.filter((item) => item.status === 'closed'),
    [conversations],
  )

  async function perform(action, successMessage) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      setNotice(result?.message || successMessage)
      await loadPage()
      return result
    } catch (actionError) {
      setError(actionError.message || 'Your message could not be saved.')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function selectConversation(id) {
    setError('')
    setNotice('')
    navigate(`/client-portal/messages/${id}`)
  }

  async function createConversation(event) {
    event.preventDefault()
    const result = await perform(
      () => createClientPortalInboxConversation(newMessage),
      'Your private message was sent.',
    )
    if (result?.conversation) {
      setNewMessage(emptyMessage)
      setShowNew(false)
      navigate(`/client-portal/messages/${result.conversation.id}`)
    }
  }

  async function sendReply(event) {
    event.preventDefault()
    if (!conversation) return
    const result = await perform(
      () => sendClientPortalInboxMessage(conversation.id, reply),
      'Your reply was sent.',
    )
    if (result) setReply(emptyReply)
  }

  async function changeStatus() {
    if (!conversation) return
    const nextStatus = conversation.status === 'closed' ? 'open' : 'closed'
    await perform(
      () => updateClientPortalInboxConversation(conversation.id, nextStatus),
      nextStatus === 'closed' ? 'Conversation closed.' : 'Conversation reopened.',
    )
  }

  async function markEncouragementRead(messageId) {
    const current = encouragements.find((item) => item.id === messageId)
    if (!current || current.read_at) return

    try {
      const result = await markClientPortalMessageRead(messageId)
      setEncouragements((items) =>
        items.map((item) =>
          item.id === messageId
            ? { ...item, read_at: result.readAt || new Date().toISOString() }
            : item,
        ),
      )
      setEncouragementUnread((value) => Math.max(0, value - 1))
    } catch {
      // The message remains readable even if read tracking is briefly unavailable.
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  return (
    <main className="client-portal-app-page-v3">
      <section className="client-portal-app-shell-v3">
        <header className="client-portal-app-header-v3">
          <div className="client-portal-app-brand-v3">
            <span>Power Within</span>
            <strong>Client Portal</strong>
          </div>
          <div className="client-portal-app-user-v3">
            <div><span>Signed in as</span><strong>{client?.name || client?.email || 'Client'}</strong></div>
            <Link to="/">Website</Link>
            <button type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </header>

        <nav className="client-portal-navigation-v3" aria-label="Client portal">
          {portalSections.map(([label, path]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <span>{label}</span>
              {path === '/client-portal/messages' && totalUnread > 0 && <em>{totalUnread}</em>}
            </NavLink>
          ))}
        </nav>

        <section className="client-portal-section-heading-v3 client-inbox-heading">
          <p className="eyebrow">Private Communication</p>
          <h1>Messages</h1>
          <p>
            Send Power Within a private question, continue a conversation, or return to encouragements shared for your journey.
          </p>
        </section>

        {(error || notice) && (
          <div className={`client-inbox-notice${error ? ' is-error' : ''}`} role="status">
            {error || notice}
          </div>
        )}

        <div className="client-inbox-tabs" role="tablist" aria-label="Message areas">
          <button type="button" className={activeTab === 'inbox' ? 'is-active' : ''} onClick={() => setActiveTab('inbox')}>
            Private Inbox {inboxUnread > 0 && <span>{inboxUnread}</span>}
          </button>
          <button type="button" className={activeTab === 'encouragements' ? 'is-active' : ''} onClick={() => setActiveTab('encouragements')}>
            Encouragements {encouragementUnread > 0 && <span>{encouragementUnread}</span>}
          </button>
        </div>

        {loading ? (
          <div className="client-inbox-empty">Opening your messages…</div>
        ) : activeTab === 'encouragements' ? (
          <section className="client-encouragements-list">
            {encouragements.length === 0 ? (
              <div className="client-inbox-empty">
                <strong>No encouragements yet.</strong>
                <p>Published notes from Power Within will appear here.</p>
              </div>
            ) : (
              encouragements.map((message) => (
                <article key={message.id} className={message.read_at ? '' : 'is-unread'} onClick={() => markEncouragementRead(message.id)}>
                  <div><span>{message.read_at ? 'Read' : 'New'}</span><time>{formatDateTime(message.published_at || message.created_at)}</time></div>
                  {message.title && <h2>{message.title}</h2>}
                  <p>{message.body}</p>
                </article>
              ))
            )}
          </section>
        ) : (
          <>
            <div className="client-inbox-toolbar">
              <div>
                <strong>{openConversations.length} open</strong>
                <span>{closedConversations.length} closed</span>
              </div>
              <button type="button" onClick={() => setShowNew(true)}>New Private Message</button>
            </div>

            <div className="client-inbox-workspace">
              <aside className="client-inbox-list" aria-label="Private conversations">
                {conversations.length === 0 ? (
                  <div className="client-inbox-empty">
                    <strong>No private conversations yet.</strong>
                    <p>Use New Private Message whenever you need support.</p>
                  </div>
                ) : (
                  conversations.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={conversation?.id === item.id ? 'is-active' : ''}
                      onClick={() => selectConversation(item.id)}
                    >
                      <div>
                        <strong>{item.subject}</strong>
                        {Number(item.unread_client_count || 0) > 0 && <em>{item.unread_client_count}</em>}
                      </div>
                      <p>{item.latest_message || 'Conversation started.'}</p>
                      <span>{readable(item.status)} · {formatDateTime(item.last_message_at)}</span>
                    </button>
                  ))
                )}
              </aside>

              <section className="client-inbox-thread">
                {!conversation ? (
                  <div className="client-inbox-empty is-large">
                    <strong>Select a conversation.</strong>
                    <p>Your private messages with Power Within will appear here.</p>
                  </div>
                ) : (
                  <>
                    <header>
                      <div>
                        <p>Private conversation</p>
                        <h2>{conversation.subject}</h2>
                        <span>{readable(conversation.status)}</span>
                      </div>
                      <button type="button" onClick={changeStatus} disabled={busy}>
                        {conversation.status === 'closed' ? 'Reopen' : 'Close Conversation'}
                      </button>
                    </header>

                    <div className="client-inbox-thread__messages">
                      {(conversation.messages || []).map((message) => (
                        <article key={message.id} className={message.sender_role === 'client' ? 'is-client' : 'is-team'}>
                          <div><strong>{message.sender_name}</strong><time>{formatDateTime(message.created_at)}</time></div>
                          <p>{message.body}</p>
                          {message.attachment_url && (
                            <a href={message.attachment_url} target="_blank" rel="noreferrer">
                              {message.attachment_label || 'Open attachment'}
                            </a>
                          )}
                        </article>
                      ))}
                    </div>

                    <form className="client-inbox-reply" onSubmit={sendReply}>
                      <label>
                        <span>Your reply</span>
                        <textarea rows="5" value={reply.body} onChange={(event) => setReply((current) => ({ ...current, body: event.target.value }))} placeholder="Write your private reply here." required />
                      </label>
                      <details>
                        <summary>Add a secure resource link</summary>
                        <div>
                          <label><span>Link</span><input type="url" value={reply.attachmentUrl} onChange={(event) => setReply((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" /></label>
                          <label><span>Link name</span><input value={reply.attachmentLabel} onChange={(event) => setReply((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="My document" /></label>
                        </div>
                      </details>
                      <button type="submit" disabled={busy || !reply.body.trim()}>{busy ? 'Sending…' : 'Send Reply'}</button>
                    </form>
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {showNew && (
          <div className="client-inbox-modal" role="dialog" aria-modal="true" aria-label="New private message">
            <form onSubmit={createConversation}>
              <header><div><p className="eyebrow">Private Message</p><h2>Contact Power Within</h2></div><button type="button" onClick={() => setShowNew(false)} aria-label="Close">×</button></header>
              <p className="client-inbox-modal__help">This is private between you and the Power Within team. Community members cannot see it.</p>
              <label><span>Subject</span><input value={newMessage.subject} onChange={(event) => setNewMessage((current) => ({ ...current, subject: event.target.value }))} placeholder="What would you like help with?" required /></label>
              <label><span>Message</span><textarea rows="7" value={newMessage.body} onChange={(event) => setNewMessage((current) => ({ ...current, body: event.target.value }))} placeholder="Share the details you would like the team to know." required /></label>
              <details>
                <summary>Add a secure resource link</summary>
                <div>
                  <label><span>Link</span><input type="url" value={newMessage.attachmentUrl} onChange={(event) => setNewMessage((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" /></label>
                  <label><span>Link name</span><input value={newMessage.attachmentLabel} onChange={(event) => setNewMessage((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="My document" /></label>
                </div>
              </details>
              <footer><button type="button" onClick={() => setShowNew(false)}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send Private Message'}</button></footer>
            </form>
          </div>
        )}
      </section>
    </main>
  )
}
