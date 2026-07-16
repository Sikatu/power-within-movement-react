import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminAdvancedFilterToggle from '../../components/admin/AdminAdvancedFilterToggle.jsx'
import AdminFrame from '../../components/admin/AdminFrame'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'
import {
  clearReadAdminNotifications,
  dismissAdminNotification,
  getAdminNotifications,
  getMyTeamAccess,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../../lib/nativeApi'

const categoryDefinitions = [
  {
    key: 'inbox',
    label: 'Inbox',
    shortLabel: 'Inbox',
    description: 'Private client conversations and replies.',
    modules: ['inbox'],
    mark: 'M',
  },
  {
    key: 'sessions',
    label: 'Sessions',
    shortLabel: 'Sessions',
    description: 'Booking, cancellation, and rescheduling movement.',
    modules: ['sessions'],
    mark: 'S',
  },
  {
    key: 'resources',
    label: 'Client Resources',
    shortLabel: 'Resources',
    description: 'Portal resources and client-care materials.',
    modules: ['clients', 'learning'],
    mark: 'R',
  },
  {
    key: 'learning',
    label: 'Learning Library',
    shortLabel: 'Learning',
    description: 'Course, lesson, and learning-access updates.',
    modules: ['learning'],
    mark: 'L',
  },
  {
    key: 'memberships',
    label: 'Memberships',
    shortLabel: 'Memberships',
    description: 'Membership access, renewal, and plan activity.',
    modules: ['memberships'],
    mark: 'P',
  },
  {
    key: 'encouragements',
    label: 'Encouragements',
    shortLabel: 'Encouragements',
    description: 'Scheduled and published encouragement activity.',
    modules: ['encouragements'],
    mark: 'E',
  },
  {
    key: 'community',
    label: 'The Circle',
    shortLabel: 'Community',
    description: 'Community conversations and moderation updates.',
    modules: ['circle'],
    mark: 'C',
  },
  {
    key: 'system',
    label: 'Studio System',
    shortLabel: 'System',
    description: 'Account, platform, automation, and security updates.',
    modules: [],
    mark: '!',
  },
]

const categoryMap = new Map(
  categoryDefinitions.map((category) => [category.key, category]),
)

function readCachedUser() {
  if (typeof window === 'undefined') return null

  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

function roleLabel(role) {
  return {
    developer: 'Developer',
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Studio Team',
  }[role] || 'Private account'
}

function formatTime(value) {
  if (!value) return 'Time unavailable'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Time unavailable'
  }
}

function dayStart(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function groupLabel(value, now = new Date()) {
  const date = dayStart(value)
  if (!date) return 'Earlier activity'

  const today = dayStart(now)
  const difference = Math.round((today - date) / 86_400_000)

  if (difference <= 0) return 'Today'
  if (difference === 1) return 'Yesterday'
  if (difference <= 7) return 'This week'
  return 'Earlier activity'
}

function importanceLabel(value) {
  if (value === 'urgent') return 'Urgent'
  if (value === 'high') return 'Priority'
  return 'Standard'
}

function hasPermission(teamAccess, modules) {
  if (!modules.length) return true

  return modules.some((moduleName) => (
    (teamAccess?.permissions?.[moduleName] || 'none') !== 'none'
  ))
}

function matchesSearch(notification, query) {
  if (!query) return true

  const category = categoryMap.get(notification.category)
  const haystack = [
    notification.title,
    notification.body,
    notification.actionLabel,
    category?.label,
    category?.description,
  ].join(' ').toLowerCase()

  return haystack.includes(query)
}

export default function AdminActivityCenter() {
  const navigate = useNavigate()
  const confirmAction = useAdminConfirm()
  const [adminUser] = useState(readCachedUser)
  const [teamAccess, setTeamAccess] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [readState, setReadState] = useState('all')
  const [importance, setImportance] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activityClock, setActivityClock] = useState(() => Date.now())

  const role = adminUser?.role || 'staff'
  const isStaff = role === 'staff'

  const loadActivity = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const [notificationResponse, accessResponse] = await Promise.all([
        getAdminNotifications({ limit: 100 }),
        isStaff ? getMyTeamAccess().catch(() => null) : Promise.resolve(null),
      ])

      setNotifications(notificationResponse.notifications || [])
      setTeamAccess(accessResponse?.access || null)
      setActivityClock(Date.now())
    } catch (loadError) {
      setError(loadError.message || 'Studio activity could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isStaff])

  useEffect(() => {
    const timer = window.setTimeout(loadActivity, 0)
    return () => window.clearTimeout(timer)
  }, [loadActivity])

  const visibleCategories = useMemo(() => (
    categoryDefinitions.filter((definition) => (
      !isStaff || hasPermission(teamAccess, definition.modules)
    ))
  ), [isStaff, teamAccess])

  const visibleCategoryKeys = useMemo(
    () => new Set(visibleCategories.map((definition) => definition.key)),
    [visibleCategories],
  )

  const activeCategory = category === 'all' || visibleCategoryKeys.has(category)
    ? category
    : 'all'

  const roleVisibleNotifications = useMemo(() => (
    notifications.filter((notification) => (
      visibleCategoryKeys.has(notification.category)
      || !categoryMap.has(notification.category)
    ))
  ), [notifications, visibleCategoryKeys])

  const activityMetrics = useMemo(() => {
    const oneDayAgo = activityClock - 86_400_000

    return {
      total: roleVisibleNotifications.length,
      unread: roleVisibleNotifications.filter((item) => !item.readAt).length,
      priority: roleVisibleNotifications.filter((item) => (
        !item.readAt && ['high', 'urgent'].includes(item.importance)
      )).length,
      today: roleVisibleNotifications.filter((item) => (
        new Date(item.createdAt).getTime() >= oneDayAgo
      )).length,
    }
  }, [activityClock, roleVisibleNotifications])

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return roleVisibleNotifications.filter((notification) => {
      if (activeCategory !== 'all' && notification.category !== activeCategory) return false
      if (readState === 'unread' && notification.readAt) return false
      if (readState === 'read' && !notification.readAt) return false
      if (importance !== 'all' && notification.importance !== importance) return false
      return matchesSearch(notification, normalizedQuery)
    })
  }, [activeCategory, importance, query, readState, roleVisibleNotifications])

  const groupedNotifications = useMemo(() => {
    const groups = new Map([
      ['Today', []],
      ['Yesterday', []],
      ['This week', []],
      ['Earlier activity', []],
    ])

    filteredNotifications.forEach((notification) => {
      groups.get(groupLabel(notification.createdAt, new Date(activityClock)))?.push(notification)
    })

    return [...groups.entries()].filter(([, items]) => items.length)
  }, [activityClock, filteredNotifications])

  function updateNotificationRead(notificationId) {
    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId
        ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
        : notification
    )))
  }

  async function openNotification(notification) {
    setError('')
    setNotice('')

    try {
      if (!notification.readAt) {
        await markAdminNotificationRead(notification.id)
        updateNotificationRead(notification.id)
      }

      if (!notification.actionUrl) return

      if (notification.actionUrl.startsWith('/')) {
        navigate(notification.actionUrl)
      } else {
        window.location.assign(notification.actionUrl)
      }
    } catch (actionError) {
      setError(actionError.message || 'This activity item could not be opened.')
    }
  }

  async function markAllRead() {
    if (!activityMetrics.unread || saving) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await markAllAdminNotificationsRead()
      const timestamp = new Date().toISOString()
      setNotifications((current) => current.map((notification) => ({
        ...notification,
        readAt: notification.readAt || timestamp,
      })))
      setNotice(response.message || 'All visible activity marked as read.')
    } catch (actionError) {
      setError(actionError.message || 'Activity could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function clearRead() {
    const readCount = roleVisibleNotifications.filter((item) => item.readAt).length
    if (!readCount || saving) return

    const confirmed = await confirmAction({
      title: 'Clear read activity?',
      message: `This removes ${readCount} read update${readCount === 1 ? '' : 's'} from your personal Activity Center.`,
      detail: 'Unread and priority updates remain available.',
      confirmLabel: 'Clear read activity',
      cancelLabel: 'Keep activity',
      tone: 'warning',
    })

    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await clearReadAdminNotifications()
      setNotifications((current) => current.filter((notification) => !notification.readAt))
      setNotice(response.message || 'Read activity cleared.')
    } catch (actionError) {
      setError(actionError.message || 'Read activity could not be cleared.')
    } finally {
      setSaving(false)
    }
  }

  async function dismissNotification(notification) {
    const confirmed = await confirmAction({
      title: 'Remove this activity item?',
      message: notification.title,
      detail: 'This removes the update from your personal Activity Center only.',
      confirmLabel: 'Remove update',
      cancelLabel: 'Keep update',
      tone: 'warning',
    })

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await dismissAdminNotification(notification.id)
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      setNotice('Activity item removed.')
    } catch (actionError) {
      setError(actionError.message || 'The activity item could not be removed.')
    }
  }

  function resetFilters() {
    setQuery('')
    setCategory('all')
    setReadState('all')
    setImportance('all')
  }

  return (
    <AdminFrame>
      <div className="pwc-activity13-page">
        <header className="pwc-activity13-hero">
          <div className="pwc-activity13-hero-copy">
            <p className="admin-eyebrow">Studio Activity Center</p>
            <h1>Everything that needs your attention, in one calm timeline.</h1>
            <p>
              Review role-relevant client care, sessions, communications,
              programs, community, and system movement without jumping between
              every workspace.
            </p>
          </div>

          <aside className="pwc-activity13-role-card" aria-label="Activity visibility">
            <span className="pwc-activity13-role-mark" aria-hidden="true">
              {roleLabel(role).charAt(0)}
            </span>
            <div>
              <small>Your activity view</small>
              <strong>{roleLabel(role)}</strong>
              <p>
                {isStaff
                  ? `${visibleCategories.length} permitted activity categories are visible.`
                  : 'All Studio activity categories assigned to this account are visible.'}
              </p>
            </div>
          </aside>
        </header>

        {(error || notice) && (
          <div
            className={`pwc-activity13-message${error ? ' is-error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </div>
        )}

        <section className="pwc-activity13-metrics" aria-label="Activity summary">
          <article>
            <span>Unread</span>
            <strong>{activityMetrics.unread}</strong>
            <p>Updates not yet reviewed</p>
          </article>
          <article className={activityMetrics.priority ? 'is-priority' : ''}>
            <span>Priority</span>
            <strong>{activityMetrics.priority}</strong>
            <p>High or urgent unread items</p>
          </article>
          <article>
            <span>Last 24 hours</span>
            <strong>{activityMetrics.today}</strong>
            <p>Recent Studio movement</p>
          </article>
          <article>
            <span>Visible activity</span>
            <strong>{activityMetrics.total}</strong>
            <p>Updates available to your role</p>
          </article>
        </section>

        <section className="pwc-activity13-workspace" aria-labelledby="pwc-activity13-title">
          <div className="pwc-activity13-heading">
            <div>
              <p className="admin-eyebrow">Personal activity feed</p>
              <h2 id="pwc-activity13-title">Studio timeline</h2>
              <p>
                {filteredNotifications.length} update{filteredNotifications.length === 1 ? '' : 's'} match this view.
              </p>
            </div>

            <div className="pwc-activity13-heading-actions">
              <button
                type="button"
                onClick={() => loadActivity({ quiet: true })}
                disabled={loading || refreshing || saving}
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={markAllRead}
                disabled={saving || !activityMetrics.unread}
              >
                Mark all read
              </button>
              <button
                className="is-subtle"
                type="button"
                onClick={clearRead}
                disabled={saving || !roleVisibleNotifications.some((item) => item.readAt)}
              >
                Clear read
              </button>
            </div>
          </div>

          <div className="pwc-activity13-category-filter" role="group" aria-label="Filter by activity category">
            <button
              type="button"
              className={activeCategory === 'all' ? 'is-active' : ''}
              aria-pressed={activeCategory === 'all'}
              onClick={() => setCategory('all')}
            >
              All
            </button>
            {visibleCategories.map((definition) => (
              <button
                type="button"
                key={definition.key}
                className={activeCategory === definition.key ? 'is-active' : ''}
                aria-pressed={activeCategory === definition.key}
                onClick={() => setCategory(definition.key)}
              >
                <span aria-hidden="true">{definition.mark}</span>
                {definition.shortLabel}
              </button>
            ))}
          </div>

          <div className={`pwc-activity13-controls pwc-ops36-filters${filtersOpen ? ' is-open' : ''}`}>
            <label className="pwc-activity13-search">
              <span>Search activity</span>
              <input
                type="search"
                value={query}
                placeholder="Search titles, details, or categories…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <AdminAdvancedFilterToggle
              open={filtersOpen}
              activeCount={[readState !== 'all', importance !== 'all'].filter(Boolean).length}
              onToggle={() => setFiltersOpen((current) => !current)}
            />

            <label>
              <span>Read state</span>
              <select value={readState} onChange={(event) => setReadState(event.target.value)}>
                <option value="all">All updates</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </select>
            </label>

            <label>
              <span>Importance</span>
              <select value={importance} onChange={(event) => setImportance(event.target.value)}>
                <option value="all">All importance</option>
                <option value="urgent">Urgent</option>
                <option value="high">Priority</option>
                <option value="normal">Standard</option>
              </select>
            </label>

            <button className="pwc-activity13-reset" type="button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>

          {loading ? (
            <div className="pwc-activity13-loading" aria-label="Loading Studio activity">
              <span />
              <span />
              <span />
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="pwc-activity13-empty">
              <span aria-hidden="true">✓</span>
              <h3>No activity matches this view.</h3>
              <p>Adjust the filters, or enjoy the calm while the Studio is caught up.</p>
              <button type="button" onClick={resetFilters}>Show all activity</button>
            </div>
          ) : (
            <div className="pwc-activity13-groups" aria-live="polite">
              {groupedNotifications.map(([label, items]) => (
                <section className="pwc-activity13-group" key={label} aria-labelledby={`pwc-activity13-${label.replaceAll(' ', '-').toLowerCase()}`}>
                  <div className="pwc-activity13-group-heading">
                    <h3 id={`pwc-activity13-${label.replaceAll(' ', '-').toLowerCase()}`}>{label}</h3>
                    <span>{items.length}</span>
                  </div>

                  <div className="pwc-activity13-list">
                    {items.map((notification) => {
                      const categoryDefinition = categoryMap.get(notification.category) || {
                        label: 'Studio Update',
                        mark: '•',
                      }

                      return (
                        <article
                          className={`pwc-activity13-item${notification.readAt ? '' : ' is-unread'} is-${notification.importance || 'normal'}`}
                          key={notification.id}
                        >
                          <span className="pwc-activity13-item-mark" aria-hidden="true">
                            {categoryDefinition.mark}
                          </span>

                          <button
                            className="pwc-activity13-item-main"
                            type="button"
                            onClick={() => openNotification(notification)}
                          >
                            <span className="pwc-activity13-item-meta">
                              <strong>{categoryDefinition.label}</strong>
                              <em>{importanceLabel(notification.importance)}</em>
                              <time dateTime={notification.createdAt || undefined}>{formatTime(notification.createdAt)}</time>
                            </span>
                            <span className="pwc-activity13-item-copy">
                              <strong>{notification.title}</strong>
                              <span>{notification.body}</span>
                              {notification.actionLabel && <em>{notification.actionLabel} →</em>}
                            </span>
                          </button>

                          <button
                            className="pwc-activity13-remove"
                            type="button"
                            aria-label={`Remove activity: ${notification.title}`}
                            onClick={() => dismissNotification(notification)}
                          >
                            ×
                          </button>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminFrame>
  )
}
