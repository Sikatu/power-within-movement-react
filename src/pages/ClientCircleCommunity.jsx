import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import NotificationCenter from '../components/NotificationCenter'
import {
  createClientCircleComment,
  deleteClientCircleComment,
  getClientCircleCommunity,
  getClientPortalDashboard,
  getClientPortalMessages,
  logoutClientPortal,
  reportClientCircleContent,
  setClientCircleReaction,
} from '../lib/nativeApi'

import './ClientPortal.css'
import './CircleCommunity.css'

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

const reactionOptions = [
  { id: 'heart', label: 'Heart', symbol: '♡' },
  { id: 'celebrate', label: 'Celebrate', symbol: '✦' },
  { id: 'support', label: 'Support', symbol: '○' },
]

function readable(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function getReactionCount(post, type) {
  return Number(post.reactions?.find((reaction) => reaction.reaction_type === type)?.count || 0)
}

function ClientPortalShell({ client, unreadCount, isLoggingOut, onLogout, children }) {
  return (
    <main className="client-portal-app-page-v3">
      <section className="client-portal-app-shell-v3">
        <header className="client-portal-app-header-v3">
          <div className="client-portal-app-brand-v3">
            <span>Power Within</span>
            <strong>Client Portal</strong>
          </div>

          <div className="client-portal-app-user-v3">
            <div>
              <span>Signed in as</span>
              <strong>{client?.name || client?.email || 'Client'}</strong>
            </div>
            <NotificationCenter mode="client" />
            <Link to="/">Website</Link>
            <button type="button" onClick={onLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </header>

        <nav className="client-portal-navigation-v3" aria-label="Client portal">
          {portalSections.map(([label, path]) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              <span>{label}</span>
              {path === '/client-portal/messages' && unreadCount > 0 && <em>{unreadCount}</em>}
            </NavLink>
          ))}
        </nav>

        <section className="client-portal-section-heading-v3 circle-client-heading">
          <p className="eyebrow">Member Community</p>
          <h1>The Circle</h1>
          <p>
            A thoughtful place for founder notes, member conversations, events, encouragement,
            and shared growth.
          </p>
        </section>

        {children}
      </section>
    </main>
  )
}

export default function ClientCircleCommunity() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [posts, setPosts] = useState([])
  const [memberships, setMemberships] = useState([])
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [hasMembershipAccess, setHasMembershipAccess] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [busyId, setBusyId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [reportForm, setReportForm] = useState({ reason: 'other', details: '' })

  useEffect(() => {
    document.body.classList.add('client-portal-mode')
    return () => document.body.classList.remove('client-portal-mode')
  }, [])

  const loadCircle = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const [dashboardResult, circleResult, messagesResult] = await Promise.all([
        getClientPortalDashboard(),
        getClientCircleCommunity(),
        getClientPortalMessages().catch(() => ({ unreadCount: 0 })),
      ])

      setClient(dashboardResult.client || null)
      setPosts(circleResult.posts || [])
      setMemberships(circleResult.memberships || [])
      setFeatureEnabled(circleResult.featureEnabled !== false)
      setHasMembershipAccess(Boolean(circleResult.hasMembershipAccess))
      setUnreadCount(Number(messagesResult.unreadCount || 0))
    } catch (loadError) {
      const message = loadError.message || 'The Circle could not open.'
      setError(message)
      if (/login required|unauthorized|401/i.test(message)) {
        navigate('/client-portal/login', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadCircle, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadCircle])

  const pinnedPosts = useMemo(() => posts.filter((post) => post.is_pinned), [posts])
  const regularPosts = useMemo(() => posts.filter((post) => !post.is_pinned), [posts])
  const orderedPosts = [...pinnedPosts, ...regularPosts]

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  async function runAction(action, successMessage) {
    setError('')
    setNotice('')
    try {
      const result = await action()
      setNotice(result?.message || successMessage)
      await loadCircle()
      return result
    } catch (actionError) {
      setError(actionError.message || 'The Circle could not save that change.')
      return null
    }
  }

  async function submitComment(postId) {
    const body = String(commentDrafts[postId] || '').trim()
    if (!body) {
      setError('Write a comment before posting.')
      return
    }

    setBusyId(`comment-${postId}`)
    const result = await runAction(
      () => createClientCircleComment(postId, body),
      'Your comment was added.',
    )
    if (result) {
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setExpandedComments((current) => ({ ...current, [postId]: true }))
    }
    setBusyId('')
  }

  async function handleReaction(post, reactionType) {
    setBusyId(`reaction-${post.id}`)
    await runAction(
      () => setClientCircleReaction(post.id, post.my_reaction === reactionType ? null : reactionType),
      'Reaction saved.',
    )
    setBusyId('')
  }

  async function removeComment(comment) {
    if (!window.confirm('Remove your comment from The Circle?')) return
    setBusyId(comment.id)
    await runAction(() => deleteClientCircleComment(comment.id), 'Your comment was removed.')
    setBusyId('')
  }

  async function submitReport(event) {
    event.preventDefault()
    if (!reportTarget) return
    setBusyId('report')

    const payload = {
      reason: reportForm.reason,
      details: reportForm.details.trim(),
      ...(reportTarget.type === 'post'
        ? { postId: reportTarget.id }
        : { commentId: reportTarget.id }),
    }

    const result = await runAction(
      () => reportClientCircleContent(payload),
      'Thank you. Power Within will review this privately.',
    )
    if (result) {
      setReportTarget(null)
      setReportForm({ reason: 'other', details: '' })
    }
    setBusyId('')
  }

  function renderPost(post) {
    const commentsAreExpanded = Boolean(expandedComments[post.id])
    const visibleComments = commentsAreExpanded ? post.comments || [] : (post.comments || []).slice(0, 2)

    return (
      <article className={`circle-client-post ${post.is_pinned ? 'is-pinned' : ''}`} key={post.id}>
        <header>
          <div>
            <div className="circle-client-post-meta">
              {post.is_pinned && <span>Pinned</span>}
              <span>{readable(post.post_type)}</span>
              <span>{post.membership_name || 'All members'}</span>
            </div>
            <h2>{post.title}</h2>
            <p className="circle-client-author">{post.author_name || 'Power Within'} · {formatDateTime(post.published_at)} ET</p>
          </div>
          <button type="button" className="circle-client-text-button" onClick={() => setReportTarget({ type: 'post', id: post.id, title: post.title })}>
            Report
          </button>
        </header>

        <p className="circle-client-post-body">{post.body}</p>

        {(post.post_type === 'event' || post.post_type === 'challenge') && post.event_starts_at && (
          <div className="circle-client-event-card">
            <span>{post.post_type === 'event' ? 'Event time' : 'Challenge window'}</span>
            <strong>{formatDateTime(post.event_starts_at)} ET</strong>
            {post.event_ends_at && <small>Through {formatDateTime(post.event_ends_at)} ET</small>}
          </div>
        )}

        {post.reactions_enabled && (
          <div className="circle-client-reactions" aria-label="Post reactions">
            {reactionOptions.map((reaction) => (
              <button
                type="button"
                key={reaction.id}
                className={post.my_reaction === reaction.id ? 'is-active' : ''}
                onClick={() => handleReaction(post, reaction.id)}
                disabled={busyId === `reaction-${post.id}`}
                aria-pressed={post.my_reaction === reaction.id}
              >
                <span aria-hidden="true">{reaction.symbol}</span>
                {reaction.label}
                <em>{getReactionCount(post, reaction.id)}</em>
              </button>
            ))}
          </div>
        )}

        {post.comments_enabled && (
          <section className="circle-client-comments">
            <div className="circle-client-comments-heading">
              <h3>Conversation</h3>
              <span>{post.comments?.length || 0} comment{post.comments?.length === 1 ? '' : 's'}</span>
            </div>

            <div className="circle-client-comment-list">
              {visibleComments.map((comment) => (
                <article key={comment.id}>
                  <div>
                    <strong>{comment.author_name || 'Member'}</strong>
                    <time>{formatDateTime(comment.created_at)} ET</time>
                  </div>
                  <p>{comment.body}</p>
                  <div className="circle-client-comment-actions">
                    {comment.is_mine ? (
                      <button type="button" onClick={() => removeComment(comment)} disabled={busyId === comment.id}>Remove</button>
                    ) : (
                      <button type="button" onClick={() => setReportTarget({ type: 'comment', id: comment.id, title: `Comment by ${comment.author_name || 'member'}` })}>Report</button>
                    )}
                  </div>
                </article>
              ))}
              {!post.comments?.length && <p className="circle-client-empty-note">Be the first to add a thoughtful response.</p>}
            </div>

            {(post.comments?.length || 0) > 2 && (
              <button
                type="button"
                className="circle-client-show-comments"
                onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !commentsAreExpanded }))}
              >
                {commentsAreExpanded ? 'Show fewer comments' : `Show all ${post.comments.length} comments`}
              </button>
            )}

            <div className="circle-client-comment-composer">
              <textarea
                rows="3"
                value={commentDrafts[post.id] || ''}
                maxLength={1500}
                placeholder="Add a kind, thoughtful comment..."
                onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
              />
              <button type="button" onClick={() => submitComment(post.id)} disabled={busyId === `comment-${post.id}`}>
                {busyId === `comment-${post.id}` ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </section>
        )}
      </article>
    )
  }

  return (
    <ClientPortalShell
      client={client}
      unreadCount={unreadCount}
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
    >
      {notice && <div className="circle-client-alert is-success">{notice}</div>}
      {error && <div className="circle-client-alert is-error">{error}</div>}

      {isLoading ? (
        <div className="client-portal-dashboard-message-v1">Opening The Circle...</div>
      ) : !featureEnabled ? (
        <div className="circle-client-empty-state">
          <span>Community Pause</span>
          <h2>The Circle is taking a quiet pause.</h2>
          <p>Power Within will reopen this member space when it is ready.</p>
          <Link to="/client-portal/home">Return Home</Link>
        </div>
      ) : !hasMembershipAccess ? (
        <div className="circle-client-empty-state">
          <span>Membership Required</span>
          <h2>The Circle is for active members.</h2>
          <p>Your community access will appear here when an active membership is connected to your portal.</p>
          <Link to="/client-portal/membership">View Membership</Link>
        </div>
      ) : (
        <div className="circle-client-layout">
          <aside className="circle-client-welcome">
            <p className="eyebrow">You Belong Here</p>
            <h2>A community with care at its center.</h2>
            <p>
              Share thoughtfully, protect privacy, and make room for every member’s season.
            </p>
            <div>
              <span>Your membership access</span>
              {memberships.map((membership) => <strong key={membership.id}>{membership.name}</strong>)}
            </div>
            <ul>
              <li>Keep member stories private.</li>
              <li>Respond with kindness and respect.</li>
              <li>Report concerns privately to Power Within.</li>
            </ul>
          </aside>

          <section className="circle-client-feed">
            {orderedPosts.length === 0 ? (
              <div className="circle-client-empty-state">
                <span>Community Feed</span>
                <h2>No posts have been shared yet.</h2>
                <p>Founder notes, events, challenges, and member conversations will appear here.</p>
              </div>
            ) : orderedPosts.map(renderPost)}
          </section>
        </div>
      )}

      {reportTarget && (
        <div className="circle-client-modal" role="dialog" aria-modal="true" aria-label="Report Circle content">
          <form onSubmit={submitReport}>
            <header>
              <div>
                <span>Private Report</span>
                <h2>Tell Power Within what needs attention.</h2>
                <p>{reportTarget.title}</p>
              </div>
              <button type="button" onClick={() => setReportTarget(null)}>Close</button>
            </header>

            <label>
              <span>Reason</span>
              <select value={reportForm.reason} onChange={(event) => setReportForm((current) => ({ ...current, reason: event.target.value }))}>
                <option value="privacy">Privacy concern</option>
                <option value="harassment">Harassment or disrespect</option>
                <option value="spam">Spam</option>
                <option value="misinformation">Misinformation</option>
                <option value="other">Something else</option>
              </select>
            </label>

            <label>
              <span>Optional details</span>
              <textarea rows="5" value={reportForm.details} onChange={(event) => setReportForm((current) => ({ ...current, details: event.target.value }))} placeholder="Share enough detail for the team to review privately." />
            </label>

            <button type="submit" disabled={busyId === 'report'}>{busyId === 'report' ? 'Sending...' : 'Send Private Report'}</button>
          </form>
        </div>
      )}
    </ClientPortalShell>
  )
}
