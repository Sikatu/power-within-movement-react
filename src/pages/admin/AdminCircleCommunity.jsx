import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'
import {
  archiveAdminCirclePost,
  createAdminCirclePost,
  deleteAdminCirclePost,
  getAdminCircleCommunity,
  getAdminCirclePost,
  moderateAdminCircleComment,
  pinAdminCirclePost,
  reviewAdminCircleReport,
  updateAdminCirclePost,
} from '../../lib/nativeApi'


const emptyComposer = {
  membershipId: '',
  postType: 'post',
  title: '',
  body: '',
  isPinned: false,
  commentsEnabled: true,
  reactionsEnabled: true,
  eventStartsAt: '',
  eventEndsAt: '',
}

function readable(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return 'Unknown date'
  }
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function toIsoOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function audienceLabel(post) {
  return post.membership_name || 'All active members'
}

function statusTone(status) {
  if (status === 'published' || status === 'active' || status === 'resolved') return 'is-positive'
  if (status === 'draft' || status === 'open') return 'is-warning'
  return 'is-muted'
}

export default function AdminCircleCommunity() {
  const confirmAction = useAdminConfirm()
  const [posts, setPosts] = useState([])
  const [memberships, setMemberships] = useState([])
  const [metrics, setMetrics] = useState({})
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [selectedPostId, setSelectedPostId] = useState('')
  const [selectedPost, setSelectedPost] = useState(null)
  const [composer, setComposer] = useState(emptyComposer)
  const [activeTab, setActiveTab] = useState('content')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadPost = useCallback(async (postId) => {
    if (!postId) {
      setSelectedPost(null)
      setComposer(emptyComposer)
      return
    }

    const result = await getAdminCirclePost(postId)
    const post = result.post
    setSelectedPost(post)
    setComposer({
      membershipId: post.membership_id || '',
      postType: post.post_type || 'post',
      title: post.title || '',
      body: post.body || '',
      isPinned: Boolean(post.is_pinned),
      commentsEnabled: post.comments_enabled !== false,
      reactionsEnabled: post.reactions_enabled !== false,
      eventStartsAt: toDateTimeLocal(post.event_starts_at),
      eventEndsAt: toDateTimeLocal(post.event_ends_at),
    })
    return post
  }, [])

  const loadWorkspace = useCallback(async (preferredPostId = '') => {
    const result = await getAdminCircleCommunity()
    const nextPosts = result.posts || []
    setPosts(nextPosts)
    setMemberships(result.memberships || [])
    setMetrics(result.metrics || {})
    setFeatureEnabled(result.featureEnabled !== false)

    const nextId =
      preferredPostId && nextPosts.some((post) => post.id === preferredPostId)
        ? preferredPostId
        : selectedPostId && nextPosts.some((post) => post.id === selectedPostId)
          ? selectedPostId
          : nextPosts[0]?.id || ''

    setSelectedPostId(nextId)
    const post = await loadPost(nextId)
    setActiveTab(post?.reports?.some((report) => report.status === 'open') ? 'moderation' : 'content')
  }, [loadPost, selectedPostId])

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setIsLoading(true)
        await loadWorkspace()
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'The Circle could not load.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    start()
    return () => {
      mounted = false
    }
  }, [loadWorkspace])

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return posts.filter((post) => {
      const matchesFilter = filter === 'all' || post.status === filter || post.post_type === filter
      const haystack = `${post.title} ${post.body} ${post.membership_name || ''} ${post.post_type}`.toLowerCase()
      return matchesFilter && (!query || haystack.includes(query))
    })
  }, [posts, filter, search])

  const openReports = useMemo(
    () => selectedPost?.reports?.filter((report) => report.status === 'open') || [],
    [selectedPost],
  )

  async function perform(action, successMessage, preferredPostId = selectedPostId) {
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await action()
      setNotice(result?.message || successMessage)
      await loadWorkspace(preferredPostId)
      return result
    } catch (actionError) {
      setError(actionError.message || 'The Circle could not save this change.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function selectPost(postId) {
    setSelectedPostId(postId)
    setError('')
    setNotice('')
    try {
      const post = await loadPost(postId)
      setActiveTab(post?.reports?.some((report) => report.status === 'open') ? 'moderation' : 'content')
    } catch (loadError) {
      setError(loadError.message || 'This Circle post could not load.')
    }
  }

  function startNewPost() {
    setSelectedPostId('')
    setSelectedPost(null)
    setComposer(emptyComposer)
    setActiveTab('content')
    setNotice('Start with a clear title and a warm, useful message.')
  }

  function buildPayload(status) {
    return {
      membershipId: composer.membershipId || null,
      postType: composer.postType,
      title: composer.title.trim(),
      body: composer.body.trim(),
      status,
      isPinned: composer.isPinned,
      commentsEnabled: composer.commentsEnabled,
      reactionsEnabled: composer.reactionsEnabled,
      eventStartsAt: toIsoOrNull(composer.eventStartsAt),
      eventEndsAt: toIsoOrNull(composer.eventEndsAt),
    }
  }

  async function savePost(status = selectedPost?.status || 'draft') {
    if (!composer.title.trim() || !composer.body.trim()) {
      setError('Add a title and message before saving.')
      return
    }

    if (
      composer.eventStartsAt &&
      composer.eventEndsAt &&
      new Date(composer.eventEndsAt) <= new Date(composer.eventStartsAt)
    ) {
      setError('The ending time must be later than the starting time.')
      return
    }

    if (selectedPost) {
      await perform(
        () => updateAdminCirclePost(selectedPost.id, buildPayload(status)),
        'Circle post saved.',
        selectedPost.id,
      )
      return
    }

    const result = await perform(
      () => createAdminCirclePost(buildPayload(status)),
      status === 'published' ? 'Post published.' : 'Draft saved.',
      '',
    )

    if (result?.post?.id) {
      setSelectedPostId(result.post.id)
      await loadWorkspace(result.post.id)
    }
  }

  async function handleArchive() {
    if (!selectedPost || !(await confirmAction({
      title: 'Archive this Circle post?',
      message: 'The post will be removed from member view.',
      confirmLabel: 'Archive post',
      tone: 'warning',
    }))) return
    await perform(() => archiveAdminCirclePost(selectedPost.id), 'Post archived.', selectedPost.id)
  }

  async function handleDelete() {
    if (!selectedPost || !(await confirmAction({
      title: 'Delete this Circle post permanently?',
      message: 'This draft or archived post cannot be restored after deletion.',
      confirmLabel: 'Delete post',
      tone: 'danger',
    }))) return
    const result = await perform(() => deleteAdminCirclePost(selectedPost.id), 'Post deleted.', '')
    if (result) {
      setSelectedPostId('')
      setSelectedPost(null)
      setComposer(emptyComposer)
      await loadWorkspace('')
    }
  }

  async function handleCommentModeration(comment, status) {
    setBusyId(comment.id)
    await perform(
      () => moderateAdminCircleComment(comment.id, status),
      status === 'hidden' ? 'Comment hidden.' : 'Comment restored.',
      selectedPostId,
    )
    setBusyId('')
  }

  async function handleReport(report, status) {
    setBusyId(report.id)
    await perform(
      () => reviewAdminCircleReport(report.id, status),
      status === 'resolved' ? 'Report resolved.' : 'Report dismissed.',
      selectedPostId,
    )
    setBusyId('')
  }

  return (
    <AdminFrame>
      <div className="circle-admin-page">
        <header className="circle-admin-header">
          <div>
            <p className="admin-eyebrow">Community</p>
            <h1>Circle</h1>
            <p>Publish member posts and handle conversations that need care.</p>
          </div>
          <button type="button" onClick={startNewPost}>New Circle Post</button>
        </header>

        {!featureEnabled && (
          <div className="circle-alert is-warning" role="status">
            The Circle feature is disabled in Developer Control Center. Admins can prepare drafts,
            but clients cannot open the community until it is enabled.
          </div>
        )}
        {error && <div className="circle-alert is-error" role="alert">{error}</div>}
        {notice && <div className="circle-alert is-success" role="status">{notice}</div>}

        <section className="circle-admin-metrics" aria-label="Circle summary">
          <article><span>Published</span><strong>{metrics.published || 0}</strong></article>
          <article><span>Drafts</span><strong>{metrics.drafts || 0}</strong></article>
          <article><span>Member comments</span><strong>{metrics.comments || 0}</strong></article>
          <article className={Number(metrics.openReports || 0) > 0 ? 'needs-attention' : ''}>
            <span>Open reports</span><strong>{metrics.openReports || 0}</strong>
          </article>
        </section>

        <div className="circle-admin-layout">
          <aside className="circle-admin-sidebar">
            <div className="circle-admin-sidebar-heading">
              <div>
                <span>Post library</span>
                <strong>{filteredPosts.length} post{filteredPosts.length === 1 ? '' : 's'} in view</strong>
              </div>
              <button type="button" onClick={startNewPost}>New</button>
            </div>

            <div className="circle-admin-filters">
              <input
                type="search"
                placeholder="Search Circle posts"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All posts</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
                <option value="archived">Archived</option>
                <option value="announcement">Announcements</option>
                <option value="event">Events</option>
                <option value="challenge">Challenges</option>
              </select>
            </div>

            <div className="circle-admin-post-list">
              {isLoading ? (
                <p>Loading The Circle...</p>
              ) : filteredPosts.length === 0 ? (
                <div className="circle-empty-card">
                  <span aria-hidden="true">✦</span>
                  <strong>No posts match this view.</strong>
                  <p>Create a new post or change the filter.</p>
                  <button type="button" onClick={startNewPost}>Create a Circle post</button>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <button
                    type="button"
                    key={post.id}
                    className={post.id === selectedPostId ? 'is-active' : ''}
                    onClick={() => selectPost(post.id)}
                  >
                    <div>
                      <span>{readable(post.post_type)}</span>
                      <em className={statusTone(post.status)}>{readable(post.status)}</em>
                    </div>
                    <strong>{post.title}</strong>
                    <small>{audienceLabel(post)}</small>
                    <small>{post.comment_count || 0} comments · {post.reaction_count || 0} reactions</small>
                    {Number(post.open_report_count || 0) > 0 && (
                      <b>{post.open_report_count} report{Number(post.open_report_count) === 1 ? '' : 's'} need review</b>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="circle-admin-workspace">
            <div className="circle-admin-tabs" role="tablist" aria-label="Circle workspace">
              <button
                type="button"
                className={activeTab === 'content' ? 'is-active' : ''}
                aria-selected={activeTab === 'content'}
                onClick={() => setActiveTab('content')}
              >
                Post
              </button>
              <button
                type="button"
                className={activeTab === 'moderation' ? 'is-active' : ''}
                aria-selected={activeTab === 'moderation'}
                onClick={() => setActiveTab('moderation')}
                disabled={!selectedPost}
              >
                Moderation {openReports.length > 0 ? `(${openReports.length})` : ''}
              </button>
            </div>

            {activeTab === 'content' && (
              <div className="circle-composer-card">
                <div className="circle-workspace-heading">
                  <div>
                    <p className="admin-eyebrow">{selectedPost ? 'Edit Post' : 'New Post'}</p>
                    <h2>{selectedPost?.title || 'Share something meaningful'}</h2>
                    <p>
                      Target every active member or one membership plan. Drafts remain private until published.
                    </p>
                  </div>
                  {selectedPost && (
                    <span className={`circle-status ${statusTone(selectedPost.status)}`}>
                      {readable(selectedPost.status)}
                    </span>
                  )}
                </div>

                <div className="circle-composer-fields">
                <div className="circle-form-grid two-columns">
                  <label>
                    <span>Post type</span>
                    <select
                      value={composer.postType}
                      onChange={(event) => setComposer((current) => ({ ...current, postType: event.target.value }))}
                    >
                      <option value="post">Community post</option>
                      <option value="announcement">Founder announcement</option>
                      <option value="event">Event</option>
                      <option value="challenge">Challenge</option>
                    </select>
                  </label>
                  <label>
                    <span>Who should see it?</span>
                    <select
                      value={composer.membershipId}
                      onChange={(event) => setComposer((current) => ({ ...current, membershipId: event.target.value }))}
                    >
                      <option value="">All active members</option>
                      {memberships.filter((membership) => membership.status === 'active').map((membership) => (
                        <option key={membership.id} value={membership.id}>{membership.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="circle-field">
                  <span className="circle-field-label"><span>Title</span><small>{composer.title.length}/180</small></span>
                  <input
                    value={composer.title}
                    maxLength={180}
                    onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
                    placeholder="A clear, warm title"
                  />
                </label>

                <label className="circle-field">
                  <span>Message</span>
                  <textarea
                    rows="10"
                    value={composer.body}
                    onChange={(event) => setComposer((current) => ({ ...current, body: event.target.value }))}
                    placeholder="Write the message members should receive..."
                  />
                </label>

                {(composer.postType === 'event' || composer.postType === 'challenge') && (
                  <div className="circle-form-grid two-columns">
                    <label>
                      <span>{composer.postType === 'event' ? 'Starts' : 'Challenge opens'}</span>
                      <input
                        type="datetime-local"
                        value={composer.eventStartsAt}
                        onChange={(event) => setComposer((current) => ({ ...current, eventStartsAt: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>{composer.postType === 'event' ? 'Ends' : 'Challenge closes'}</span>
                      <input
                        type="datetime-local"
                        value={composer.eventEndsAt}
                        onChange={(event) => setComposer((current) => ({ ...current, eventEndsAt: event.target.value }))}
                      />
                    </label>
                  </div>
                )}

                <div className="circle-toggle-grid">
                  <label>
                    <input
                      type="checkbox"
                      checked={composer.isPinned}
                      onChange={(event) => setComposer((current) => ({ ...current, isPinned: event.target.checked }))}
                    />
                    <span><strong>Pin this post</strong><small>Keep it at the top of the member feed.</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={composer.commentsEnabled}
                      onChange={(event) => setComposer((current) => ({ ...current, commentsEnabled: event.target.checked }))}
                    />
                    <span><strong>Allow comments</strong><small>Members can respond respectfully.</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={composer.reactionsEnabled}
                      onChange={(event) => setComposer((current) => ({ ...current, reactionsEnabled: event.target.checked }))}
                    />
                    <span><strong>Allow reactions</strong><small>Members can show support quickly.</small></span>
                  </label>
                </div>

                </div>

                <div className="circle-action-bar">
                  <div className="circle-action-meta">
                    {selectedPost?.published_at && <span>Published {formatDateTime(selectedPost.published_at)} ET</span>}
                    <small>Community dates and times are displayed in Eastern Time.</small>
                  </div>
                  <div className="circle-action-buttons">
                    <button type="button" className="is-secondary" onClick={() => savePost('draft')} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button type="button" onClick={() => savePost('published')} disabled={isSaving}>
                      {selectedPost?.status === 'published' ? 'Save Published Post' : 'Publish Now'}
                    </button>
                    {selectedPost?.status === 'published' && (
                      <button type="button" className="is-secondary" onClick={() => perform(() => pinAdminCirclePost(selectedPost.id, !selectedPost.is_pinned), selectedPost.is_pinned ? 'Post unpinned.' : 'Post pinned.', selectedPost.id)} disabled={isSaving}>
                        {selectedPost.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {selectedPost && selectedPost.status !== 'archived' && (
                      <button type="button" className="is-secondary" onClick={handleArchive} disabled={isSaving}>Archive</button>
                    )}
                    {selectedPost && selectedPost.status !== 'published' && (
                      <button type="button" className="is-danger" onClick={handleDelete} disabled={isSaving}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'moderation' && selectedPost && (
              <div className="circle-moderation-layout">
                <section className="circle-moderation-card">
                  <div className="circle-workspace-heading">
                    <div>
                      <p className="admin-eyebrow">Member Conversation</p>
                      <h2>Comments</h2>
                      <p>Hide content that breaks community expectations. Hidden comments remain in the audit history.</p>
                    </div>
                    <span>{selectedPost.comments?.length || 0}</span>
                  </div>

                  <div className="circle-moderation-list">
                    {!selectedPost.comments?.length ? (
                      <div className="circle-empty-card"><strong>No comments yet.</strong><p>Member responses will appear here.</p></div>
                    ) : selectedPost.comments.map((comment) => (
                      <article key={comment.id} className={comment.status === 'hidden' ? 'is-hidden' : ''}>
                        <div>
                          <strong>{comment.author_name || comment.author_email || 'Member'}</strong>
                          <span>{formatDateTime(comment.created_at)} ET · {readable(comment.status)}</span>
                        </div>
                        <p>{comment.body}</p>
                        <button
                          type="button"
                          className="is-secondary"
                          disabled={busyId === comment.id}
                          onClick={() => handleCommentModeration(comment, comment.status === 'hidden' ? 'active' : 'hidden')}
                        >
                          {comment.status === 'hidden' ? 'Restore Comment' : 'Hide Comment'}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="circle-moderation-card">
                  <div className="circle-workspace-heading">
                    <div>
                      <p className="admin-eyebrow">Private Reports</p>
                      <h2>Needs Review</h2>
                      <p>Reports are private. Members never see who submitted them.</p>
                    </div>
                    <span>{openReports.length}</span>
                  </div>

                  <div className="circle-moderation-list">
                    {!selectedPost.reports?.length ? (
                      <div className="circle-empty-card"><strong>No reports.</strong><p>This conversation has no moderation reports.</p></div>
                    ) : selectedPost.reports.map((report) => (
                      <article key={report.id} className={report.status !== 'open' ? 'is-resolved' : ''}>
                        <div>
                          <strong>{readable(report.reason)}</strong>
                          <span>{formatDateTime(report.created_at)} ET · {readable(report.status)}</span>
                        </div>
                        <p>{report.details || 'No additional details were provided.'}</p>
                        <small>Submitted by {report.reporter_name || report.reporter_email || 'Member'}</small>
                        {report.status === 'open' && (
                          <div className="circle-report-actions">
                            <button type="button" disabled={busyId === report.id} onClick={() => handleReport(report, 'resolved')}>Resolve</button>
                            <button type="button" className="is-secondary" disabled={busyId === report.id} onClick={() => handleReport(report, 'dismissed')}>Dismiss</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminFrame>
  )
}
