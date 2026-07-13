import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import {
  createClientCircleComment,
  deleteClientCircleComment,
  getClientCircleCommunity,
  getClientPortalDashboard,
  getClientPortalInbox,
  getClientPortalMessages,
  logoutClientPortal,
  reportClientCircleContent,
  setClientCircleReaction,
} from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalCircle.css'

const reactionOptions = [
  { id: 'heart', label: 'Heart', symbol: '♡' },
  { id: 'celebrate', label: 'Celebrate', symbol: '✦' },
  { id: 'support', label: 'Support', symbol: '○' },
]

const guidelines = [
  'Keep member stories and experiences private.',
  'Respond with kindness, curiosity, and respect.',
  'Report concerns privately to Power Within.',
]

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

function initials(name) {
  const parts = String(name || 'Power Within').trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || 'P'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase()
}

function reactionCount(post, type) {
  return Number(post.reactions?.find((reaction) => reaction.reaction_type === type)?.count || 0)
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (isAuthError(error)) return 'Your private session ended. Please sign in again.'
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach The Circle. Please check the backend connection and try again.'
  return message || 'The Circle could not save that change.'
}

function ClientPortalCircle() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [posts, setPosts] = useState([])
  const [memberships, setMemberships] = useState([])
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [hasMembershipAccess, setHasMembershipAccess] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [sharingDraft, setSharingDraft] = useState('')
  const [busyId, setBusyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [reportForm, setReportForm] = useState({ reason: 'other', details: '' })

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  const loadCircle = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')

    try {
      const [dashboardResult, circleResult, inboxResult, encouragementResult] = await Promise.all([
        getClientPortalDashboard(),
        getClientCircleCommunity(),
        getClientPortalInbox().catch(() => ({ unreadCount: 0 })),
        getClientPortalMessages().catch(() => ({ unreadCount: 0 })),
      ])

      setClient(dashboardResult.client || null)
      setPosts(circleResult.posts || [])
      setMemberships(circleResult.memberships || [])
      setFeatureEnabled(circleResult.featureEnabled !== false)
      setHasMembershipAccess(Boolean(circleResult.hasMembershipAccess))
      setMessageCount(Number(inboxResult.unreadCount || 0) + Number(encouragementResult.unreadCount || 0))
    } catch (loadError) {
      if (isAuthError(loadError)) {
        navigate('/client-portal/login', { replace: true })
        return
      }
      setError(friendlyError(loadError))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    const timeoutId = window.setTimeout(() => {
      if (active) loadCircle()
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [loadCircle])

  const orderedPosts = useMemo(() => [...posts].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1
    return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
  }), [posts])
  const featuredPost = useMemo(() => orderedPosts.find((post) => post.is_pinned && post.comments_enabled)
    || orderedPosts.find((post) => post.comments_enabled)
    || orderedPosts[0]
    || null, [orderedPosts])

  async function handleLogout() {
    setLoggingOut(true)
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
      await loadCircle(false)
      return result
    } catch (actionError) {
      if (isAuthError(actionError)) {
        navigate('/client-portal/login', { replace: true })
        return null
      }
      setError(friendlyError(actionError))
      return null
    }
  }

  async function submitFeaturedReflection(event) {
    event.preventDefault()
    const body = sharingDraft.trim()
    if (!featuredPost?.comments_enabled) {
      setError('The weekly reflection is not accepting replies right now.')
      return
    }
    if (!body) {
      setError('Write a reflection before sharing.')
      return
    }

    setBusyId(`comment-${featuredPost.id}`)
    const result = await runAction(() => createClientCircleComment(featuredPost.id, body), 'Your reflection was shared with The Circle.')
    if (result) {
      setSharingDraft('')
      setExpandedComments((current) => ({ ...current, [featuredPost.id]: true }))
    }
    setBusyId('')
  }

  async function submitComment(postId) {
    const body = String(commentDrafts[postId] || '').trim()
    if (!body) {
      setError('Write a comment before posting.')
      return
    }

    setBusyId(`comment-${postId}`)
    const result = await runAction(() => createClientCircleComment(postId, body), 'Your comment was added.')
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
      post.my_reaction === reactionType ? 'Reaction removed.' : 'Reaction saved.',
    )
    setBusyId('')
  }

  async function removeComment(comment) {
    if (!window.confirm('Remove your comment from The Circle?')) return
    setBusyId(`remove-${comment.id}`)
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
      ...(reportTarget.type === 'post' ? { postId: reportTarget.id } : { commentId: reportTarget.id }),
    }
    const result = await runAction(() => reportClientCircleContent(payload), 'Thank you. Power Within will review this privately.')
    if (result) {
      setReportTarget(null)
      setReportForm({ reason: 'other', details: '' })
    }
    setBusyId('')
  }

  function renderPost(post) {
    const comments = post.comments || []
    const commentsExpanded = Boolean(expandedComments[post.id])
    const visibleComments = commentsExpanded ? comments : comments.slice(0, 2)
    const authorName = post.author_name || 'Power Within'

    return (
      <article className={`circle-post${post.is_pinned ? ' is-pinned' : ''}`} key={post.id}>
        <header className="circle-post-author">
          <span aria-hidden="true">{initials(authorName)}</span>
          <div>
            <strong>{authorName}</strong>
            <small>{formatDateTime(post.published_at || post.created_at)} ET{post.membership_name ? ` · ${post.membership_name}` : ''}</small>
          </div>
          <button type="button" onClick={() => setReportTarget({ type: 'post', id: post.id, title: post.title || `Post by ${authorName}` })}>Report</button>
        </header>

        <div className="circle-post-labels">
          {post.is_pinned && <span>Pinned Reflection</span>}
          {post.post_type && <span>{readable(post.post_type)}</span>}
        </div>
        {post.title && <h2>{post.title}</h2>}
        <p className="circle-post-body">{post.body}</p>

        {(post.post_type === 'event' || post.post_type === 'challenge') && post.event_starts_at && (
          <div className="circle-event-card">
            <span>{post.post_type === 'event' ? 'Event Time' : 'Challenge Window'}</span>
            <strong>{formatDateTime(post.event_starts_at)} ET</strong>
            {post.event_ends_at && <small>Through {formatDateTime(post.event_ends_at)} ET</small>}
          </div>
        )}

        <div className="circle-post-actions">
          {post.reactions_enabled && reactionOptions.map((reaction) => (
            <button
              type="button"
              key={reaction.id}
              className={post.my_reaction === reaction.id ? 'is-active' : ''}
              aria-pressed={post.my_reaction === reaction.id}
              disabled={busyId === `reaction-${post.id}`}
              onClick={() => handleReaction(post, reaction.id)}
            >
              <span aria-hidden="true">{reaction.symbol}</span>{reaction.label}<em>{reactionCount(post, reaction.id)}</em>
            </button>
          ))}
          {post.comments_enabled && (
            <button type="button" className="circle-reply-toggle" aria-expanded={commentsExpanded} onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !commentsExpanded }))}>
              Reply · {comments.length}
            </button>
          )}
        </div>

        {post.comments_enabled && commentsExpanded && (
          <section className="circle-comments" aria-label={`Conversation on ${post.title || 'Circle post'}`}>
            <div className="circle-comment-list">
              {visibleComments.length === 0 ? (
                <p className="circle-empty-note">Be the first to add a thoughtful response.</p>
              ) : visibleComments.map((comment) => (
                <article key={comment.id}>
                  <div className="circle-comment-author"><span aria-hidden="true">{initials(comment.author_name || 'Member')}</span><div><strong>{comment.author_name || 'Member'}</strong><time>{formatDateTime(comment.created_at)} ET</time></div></div>
                  <p>{comment.body}</p>
                  {comment.is_mine ? (
                    <button type="button" onClick={() => removeComment(comment)} disabled={busyId === `remove-${comment.id}`}>{busyId === `remove-${comment.id}` ? 'Removing…' : 'Remove'}</button>
                  ) : (
                    <button type="button" onClick={() => setReportTarget({ type: 'comment', id: comment.id, title: `Comment by ${comment.author_name || 'member'}` })}>Report</button>
                  )}
                </article>
              ))}
            </div>

            <div className="circle-comment-composer">
              <label htmlFor={`circle-comment-${post.id}`}>Add to the conversation</label>
              <textarea id={`circle-comment-${post.id}`} rows="3" maxLength="1500" value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a kind, thoughtful response…" />
              <button type="button" onClick={() => submitComment(post.id)} disabled={busyId === `comment-${post.id}`}>{busyId === `comment-${post.id}` ? 'Posting…' : 'Post Reply'}</button>
            </div>
          </section>
        )}
      </article>
    )
  }

  return (
    <main id="main-content" className="portal-workspace portal-circle-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} messageCount={messageCount} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro circle-page-intro">
          <p className="eyebrow">The Circle</p>
          <h1>A private community for the long return.</h1>
          <p>Reflections, encouragement, and honest conversation with women walking the same season—guided by Power Within.</p>
        </header>

        {(error || notice) && <div className={`portal-notice${error ? ' is-error' : ''}`} role="status">{error || notice}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Opening The Circle…</div>
        ) : !featureEnabled ? (
          <section className="circle-access-card">
            <p className="eyebrow">Community Pause</p>
            <h2>The Circle is taking a quiet pause.</h2>
            <p>Power Within will reopen this member space when it is ready.</p>
            <Link to="/client-portal/home">Return Home</Link>
          </section>
        ) : !hasMembershipAccess ? (
          <section className="circle-access-card">
            <p className="eyebrow">Membership Required</p>
            <h2>The Circle is for active members.</h2>
            <p>Your community access will appear here when an active membership is connected to your portal.</p>
            <Link to="/client-portal/home">Return Home</Link>
          </section>
        ) : (
          <div className="circle-layout">
            <section className="circle-feed">
              {featuredPost?.comments_enabled && (
                <article className="circle-share-card">
                  <form onSubmit={submitFeaturedReflection}>
                    <label htmlFor="circle-featured-reflection"><span>Share with The Circle</span><textarea id="circle-featured-reflection" rows="3" maxLength="1500" value={sharingDraft} onChange={(event) => setSharingDraft(event.target.value)} placeholder="What is on your heart this week?" /></label>
                    <small>Your reflection joins this week&apos;s guided conversation.</small>
                    <button type="submit" disabled={busyId === `comment-${featuredPost.id}`}>{busyId === `comment-${featuredPost.id}` ? 'Sharing…' : 'Share Reflection'}</button>
                  </form>
                </article>
              )}

              {orderedPosts.length === 0 ? (
                <section className="circle-access-card"><p className="eyebrow">Community Feed</p><h2>The conversation will begin here.</h2><p>Founder reflections, events, challenges, and member conversations will appear when they are published.</p></section>
              ) : orderedPosts.map(renderPost)}
            </section>

            <aside className="circle-sidebar">
              <article className="circle-reflection-card">
                <p>This Week&apos;s Reflection</p>
                <h2>{featuredPost?.title || 'Where did you feel most like yourself this week?'}</h2>
                <span>{featuredPost?.body || 'Kim invites The Circle to notice one moment of congruence—however small—and name what made it possible.'}</span>
              </article>

              <article className="circle-guidelines-card">
                <p>Circle Guidelines</p>
                {guidelines.map((guideline) => <div key={guideline}><span aria-hidden="true" /><p>{guideline}</p></div>)}
              </article>

              <article className="circle-membership-card">
                <p>Your Membership Access</p>
                {memberships.map((membership) => <div key={membership.id}><strong>{membership.name}</strong>{membership.tagline && <span>{membership.tagline}</span>}</div>)}
              </article>
            </aside>
          </div>
        )}
      </div>

      {reportTarget && (
        <div className="portal-modal-backdrop">
          <form className="portal-modal portal-form circle-report-modal" onSubmit={submitReport} role="dialog" aria-modal="true" aria-labelledby="circle-report-title">
            <button className="portal-modal-close" type="button" onClick={() => setReportTarget(null)} aria-label="Close">×</button>
            <p className="eyebrow">Private Report</p>
            <h2 id="circle-report-title">Tell Power Within what needs attention.</h2>
            <p className="portal-modal-context">{reportTarget.title}</p>
            <label><span>Reason</span><select value={reportForm.reason} onChange={(event) => setReportForm((current) => ({ ...current, reason: event.target.value }))}><option value="privacy">Privacy concern</option><option value="harassment">Harassment or disrespect</option><option value="spam">Spam</option><option value="misinformation">Misinformation</option><option value="other">Something else</option></select></label>
            <label><span>Optional details</span><textarea rows="5" maxLength="1000" value={reportForm.details} onChange={(event) => setReportForm((current) => ({ ...current, details: event.target.value }))} placeholder="Share enough detail for the team to review privately." /></label>
            <div className="portal-modal-actions"><button type="button" onClick={() => setReportTarget(null)}>Cancel</button><button className="portal-primary-button" type="submit" disabled={busyId === 'report'}>{busyId === 'report' ? 'Sending…' : 'Send Private Report'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}

export default ClientPortalCircle
