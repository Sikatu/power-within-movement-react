import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
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
} from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'

const emptyMessage = { subject: '', body: '', attachmentUrl: '', attachmentLabel: '' }
const emptyReply = { body: '', attachmentUrl: '', attachmentLabel: '' }

function readable(value) {
  const text = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
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

function safeUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (isAuthError(error)) return 'Your private session ended. Please sign in again.'
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private inbox. Please check the backend connection and try again.'
  return message || 'Your private messages could not open.'
}

function ClientPortalMessages() {
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
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  const loadConversation = useCallback(async (id) => {
    if (!id) {
      setConversation(null)
      return
    }
    const result = await getClientPortalInboxConversation(id)
    setConversation(result.conversation || null)
    setConversations((current) => current.map((item) => (item.id === id ? { ...item, unread_client_count: 0 } : item)))
  }, [])

  const loadPage = useCallback(async () => {
    const [dashboardResult, inboxResult, messageResult] = await Promise.all([
      getClientPortalDashboard(),
      getClientPortalInbox(),
      getClientPortalMessages().catch(() => ({ messages: [], unreadCount: 0 })),
    ])

    const conversationList = inboxResult.conversations || []
    setClient(dashboardResult.client || null)
    setConversations(conversationList)
    setInboxUnread(Number(inboxResult.unreadCount || 0))
    setEncouragements(messageResult.messages || [])
    setEncouragementUnread(Number(messageResult.unreadCount || 0))

    const preferredId = conversationId || conversationList[0]?.id || ''
    if (preferredId) await loadConversation(preferredId)
    else setConversation(null)
  }, [conversationId, loadConversation])

  useEffect(() => {
    let active = true

    async function start() {
      try {
        setLoading(true)
        await loadPage()
      } catch (loadError) {
        if (!active) return
        if (isAuthError(loadError)) {
          navigate('/client-portal/login', { replace: true })
          return
        }
        setError(friendlyError(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    start()
    return () => { active = false }
  }, [loadPage, navigate])

  const totalUnread = inboxUnread + encouragementUnread
  const openConversations = useMemo(() => conversations.filter((item) => item.status !== 'closed'), [conversations])
  const closedConversations = useMemo(() => conversations.filter((item) => item.status === 'closed'), [conversations])

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
      if (isAuthError(actionError)) {
        navigate('/client-portal/login', { replace: true })
        return null
      }
      setError(friendlyError(actionError))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function createConversation(event) {
    event.preventDefault()
    const result = await perform(() => createClientPortalInboxConversation(newMessage), 'Your private message was sent.')
    if (result?.conversation) {
      setNewMessage(emptyMessage)
      setShowNew(false)
      navigate(`/client-portal/messages/${result.conversation.id}`)
    }
  }

  async function sendReply(event) {
    event.preventDefault()
    if (!conversation) return
    const result = await perform(() => sendClientPortalInboxMessage(conversation.id, reply), 'Your reply was sent.')
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
      setEncouragements((items) => items.map((item) => (item.id === messageId ? { ...item, read_at: result.readAt || new Date().toISOString() } : item)))
      setEncouragementUnread((value) => Math.max(0, value - 1))
    } catch {
      // Messages remain readable if read tracking is temporarily unavailable.
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
    <main id="main-content" className="portal-workspace portal-messages-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} messageCount={totalUnread} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro portal-message-intro">
          <p className="eyebrow">Private Communication</p>
          <h1>Messages</h1>
          <p>Send Power Within a private question, continue a conversation, or return to encouragements shared for your journey.</p>
        </header>

        {(error || notice) && <div className={`portal-notice${error ? ' is-error' : ''}`} role="status">{error || notice}</div>}

        <div className="message-tabs" role="tablist" aria-label="Message areas">
          <button type="button" role="tab" aria-selected={activeTab === 'inbox'} className={activeTab === 'inbox' ? 'is-active' : ''} onClick={() => setActiveTab('inbox')}>
            Private Inbox {inboxUnread > 0 && <span>{inboxUnread}</span>}
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'encouragements'} className={activeTab === 'encouragements' ? 'is-active' : ''} onClick={() => setActiveTab('encouragements')}>
            Encouragements {encouragementUnread > 0 && <span>{encouragementUnread}</span>}
          </button>
        </div>

        {loading ? (
          <div className="portal-loading" role="status">Opening your messages…</div>
        ) : activeTab === 'encouragements' ? (
          <section className="encouragement-list" aria-label="Encouragements">
            {encouragements.length === 0 ? (
              <div className="portal-empty portal-card"><strong>No encouragements yet.</strong><p>Published notes from Power Within will appear here.</p></div>
            ) : encouragements.map((message) => (
              <button type="button" key={message.id} className={`encouragement-card${message.read_at ? '' : ' is-unread'}`} onClick={() => markEncouragementRead(message.id)}>
                <span className="encouragement-meta"><em>{message.read_at ? 'Read' : 'New'}</em><time>{formatDateTime(message.published_at || message.created_at)}</time></span>
                {message.title && <strong>{message.title}</strong>}
                <span>{message.body}</span>
              </button>
            ))}
          </section>
        ) : (
          <>
            <div className="message-toolbar">
              <div><strong>{openConversations.length} open</strong><span>{closedConversations.length} closed</span></div>
              <button type="button" onClick={() => setShowNew(true)}>New Private Message</button>
            </div>

            <div className="message-workspace">
              <aside className="message-conversation-list" aria-label="Private conversations">
                {conversations.length === 0 ? (
                  <div className="portal-empty"><strong>No private conversations yet.</strong><p>Start a private message whenever you need support.</p></div>
                ) : conversations.map((item) => (
                  <button type="button" key={item.id} className={conversation?.id === item.id ? 'is-active' : ''} onClick={() => { setError(''); setNotice(''); navigate(`/client-portal/messages/${item.id}`) }}>
                    <span><strong>{item.subject}</strong>{Number(item.unread_client_count || 0) > 0 && <em>{item.unread_client_count}</em>}</span>
                    <p>{item.latest_message || 'Conversation started.'}</p>
                    <small>{readable(item.status)} · {formatDateTime(item.last_message_at)}</small>
                  </button>
                ))}
              </aside>

              <section className="message-thread">
                {!conversation ? (
                  <div className="portal-empty is-large"><strong>Select a conversation.</strong><p>Your private messages with Power Within will appear here.</p></div>
                ) : (
                  <>
                    <header className="message-thread-header">
                      <div><p>Private conversation</p><h2>{conversation.subject}</h2><span>{readable(conversation.status)}</span></div>
                      <button type="button" onClick={changeStatus} disabled={busy}>{conversation.status === 'closed' ? 'Reopen' : 'Close Conversation'}</button>
                    </header>

                    <div className="message-thread-list" aria-live="polite">
                      {(conversation.messages || []).map((message) => {
                        const attachmentUrl = safeUrl(message.attachment_url)
                        return (
                          <article key={message.id} className={message.sender_role === 'client' ? 'is-client' : 'is-team'}>
                            <div><strong>{message.sender_name}</strong><time>{formatDateTime(message.created_at)}</time></div>
                            <p>{message.body}</p>
                            {attachmentUrl && <a href={attachmentUrl} target="_blank" rel="noreferrer">{message.attachment_label || 'Open attachment'}</a>}
                          </article>
                        )
                      })}
                    </div>

                    {conversation.status === 'closed' ? (
                      <div className="message-closed-note">This conversation is closed. Reopen it to send a new reply.</div>
                    ) : (
                      <form className="message-reply portal-form" onSubmit={sendReply}>
                        <label><span>Your reply</span><textarea rows="5" value={reply.body} onChange={(event) => setReply((current) => ({ ...current, body: event.target.value }))} placeholder="Write your private reply here." required /></label>
                        <details className="portal-link-details">
                          <summary>Add a secure resource link</summary>
                          <div><label><span>Link</span><input type="url" value={reply.attachmentUrl} onChange={(event) => setReply((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" /></label><label><span>Link name</span><input value={reply.attachmentLabel} onChange={(event) => setReply((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="My document" /></label></div>
                        </details>
                        <button className="portal-primary-button" type="submit" disabled={busy || !reply.body.trim()}>{busy ? 'Sending…' : 'Send Reply'}</button>
                      </form>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {showNew && (
        <div className="portal-modal-backdrop">
          <form className="portal-modal message-compose-modal portal-form" onSubmit={createConversation} role="dialog" aria-modal="true" aria-labelledby="new-message-title">
            <button className="portal-modal-close" type="button" onClick={() => setShowNew(false)} aria-label="Close">×</button>
            <p className="eyebrow">Private Message</p>
            <h2 id="new-message-title">Contact Power Within</h2>
            <p className="portal-modal-context">This is private between you and the Power Within team. Community members cannot see it.</p>
            <label><span>Subject</span><input value={newMessage.subject} onChange={(event) => setNewMessage((current) => ({ ...current, subject: event.target.value }))} placeholder="What would you like help with?" required /></label>
            <label><span>Message</span><textarea rows="7" value={newMessage.body} onChange={(event) => setNewMessage((current) => ({ ...current, body: event.target.value }))} placeholder="Share the details you would like the team to know." required /></label>
            <details className="portal-link-details">
              <summary>Add a secure resource link</summary>
              <div><label><span>Link</span><input type="url" value={newMessage.attachmentUrl} onChange={(event) => setNewMessage((current) => ({ ...current, attachmentUrl: event.target.value }))} placeholder="https://…" /></label><label><span>Link name</span><input value={newMessage.attachmentLabel} onChange={(event) => setNewMessage((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="My document" /></label></div>
            </details>
            <div className="portal-modal-actions"><button type="button" onClick={() => setShowNew(false)}>Cancel</button><button className="portal-primary-button" type="submit" disabled={busy || !newMessage.subject.trim() || !newMessage.body.trim()}>{busy ? 'Sending…' : 'Send Private Message'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}

export default ClientPortalMessages
