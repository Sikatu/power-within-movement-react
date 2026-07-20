import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  clearReadAdminNotifications,
  clearReadClientNotifications,
  dismissAdminNotification,
  dismissClientNotification,
  getAdminNotificationPreferences,
  getAdminNotifications,
  getAdminNotificationSummary,
  getClientNotificationPreferences,
  getClientNotifications,
  getClientNotificationSummary,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  updateAdminNotificationPreferences,
  updateClientNotificationPreferences,
} from '../lib/nativeApi'

import './NotificationCenter.css'

const categories = [
  ['all', 'All'],
  ['inbox', 'Inbox'],
  ['sessions', 'Sessions'],
  ['resources', 'Resources'],
  ['learning', 'Learning'],
  ['memberships', 'Memberships'],
  ['encouragements', 'Encouragements'],
  ['community', 'Community'],
  ['system', 'System'],
]

const defaultCategories = Object.fromEntries(
  categories.filter(([key]) => key !== 'all').map(([key]) => [key, true]),
)

function formatTime(value) {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function safeNotificationPath(value, mode) {
  if (typeof value !== 'string') return ''

  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return ''

  try {
    const url = new URL(path, window.location.origin)
    const allowedRoot = mode === 'client' ? '/client-portal' : '/admin'
    const allowed = url.origin === window.location.origin
      && (url.pathname === allowedRoot || url.pathname.startsWith(`${allowedRoot}/`))
    return allowed ? `${url.pathname}${url.search}${url.hash}` : ''
  } catch {
    return ''
  }
}

function categoryLabel(value) {
  return categories.find(([key]) => key === value)?.[1] || 'Update'
}

export default function NotificationCenter({ mode = 'admin' }) {
  const navigate = useNavigate()
  const isClient = mode === 'client'
  const triggerRef = useRef(null)
  const drawerRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('notifications')
  const [category, setCategory] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [summary, setSummary] = useState({ total: 0, unread: 0, importantUnread: 0 })
  const [notifications, setNotifications] = useState([])
  const [preferences, setPreferences] = useState({
    emailEnabled: false,
    emailCategories: defaultCategories,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialogId = `pwc-${mode}-notification-dialog`
  const notificationPanelId = `pwc-${mode}-notification-updates`
  const preferencePanelId = `pwc-${mode}-notification-preferences`

  const api = useMemo(
    () =>
      isClient
        ? {
            summary: getClientNotificationSummary,
            list: getClientNotifications,
            markRead: markClientNotificationRead,
            markAllRead: markAllClientNotificationsRead,
            dismiss: dismissClientNotification,
            clearRead: clearReadClientNotifications,
            getPreferences: getClientNotificationPreferences,
            savePreferences: updateClientNotificationPreferences,
          }
        : {
            summary: getAdminNotificationSummary,
            list: getAdminNotifications,
            markRead: markAdminNotificationRead,
            markAllRead: markAllAdminNotificationsRead,
            dismiss: dismissAdminNotification,
            clearRead: clearReadAdminNotifications,
            getPreferences: getAdminNotificationPreferences,
            savePreferences: updateAdminNotificationPreferences,
          },
    [isClient],
  )

  const refreshSummary = useCallback(async () => {
    try {
      const response = await api.summary()
      setSummary(response.summary || { total: 0, unread: 0, importantUnread: 0 })
    } catch {
      // Keep the workspace usable if the notification service is briefly unavailable.
    }
  }, [api])

  const refreshNotifications = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.list({
        category: category === 'all' ? '' : category,
        unreadOnly,
        limit: 60,
      })
      setNotifications(response.notifications || [])
      setSummary(response.summary || { total: 0, unread: 0, importantUnread: 0 })
    } catch (loadError) {
      setError(loadError.message || 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [api, category, unreadOnly])

  useEffect(() => {
    const initialTimer = window.setTimeout(refreshSummary, 0)
    const timer = window.setInterval(refreshSummary, 60_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [refreshSummary])

  useEffect(() => {
    if (!open || view !== 'notifications') return undefined
    const timer = window.setTimeout(refreshNotifications, 0)
    return () => window.clearTimeout(timer)
  }, [open, view, refreshNotifications])

  useEffect(() => {
    if (!open || view !== 'preferences') return undefined

    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')

      api.getPreferences()
        .then((response) => {
          if (!mounted) return
          setPreferences({
            emailEnabled: Boolean(response.preferences?.emailEnabled),
            emailCategories: {
              ...defaultCategories,
              ...(response.preferences?.emailCategories || {}),
            },
          })
        })
        .catch((loadError) => {
          if (mounted) setError(loadError.message || 'Preferences could not be loaded.')
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [api, open, view])

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        window.setTimeout(() => triggerRef.current?.focus(), 0)
        return
      }

      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll(
          'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const closeCenter = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])

  function switchViewWithKeyboard(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const nextView = event.key === 'ArrowLeft' || event.key === 'Home'
      ? 'notifications'
      : 'preferences'
    setView(nextView)
    const nextTabId = nextView === 'notifications'
      ? `${dialogId}-updates-tab`
      : `${dialogId}-preferences-tab`
    window.setTimeout(() => document.getElementById(nextTabId)?.focus(), 0)
  }

  async function openNotification(notification) {
    setError('')

    try {
      if (!notification.readAt) await api.markRead(notification.id)
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: item.readAt || new Date().toISOString() }
            : item,
        ),
      )
      setSummary((current) => ({
        ...current,
        unread: Math.max(0, Number(current.unread || 0) - (notification.readAt ? 0 : 1)),
        importantUnread: Math.max(
          0,
          Number(current.importantUnread || 0) -
            (!notification.readAt && ['high', 'urgent'].includes(notification.importance) ? 1 : 0),
        ),
      }))

      const actionPath = safeNotificationPath(notification.actionUrl, mode)
      if (!notification.actionUrl) {
        setNotice('Update marked as read.')
        return
      }
      if (!actionPath) {
        setError('This update does not have a safe portal destination.')
        return
      }

      closeCenter(false)
      navigate(actionPath)
    } catch (actionError) {
      setError(actionError.message || 'This notification could not be opened.')
    }
  }

  function openFullActivity() {
    closeCenter(false)
    navigate('/admin/activity')
  }

  async function markAllRead() {
    setSaving(true)
    setError('')

    try {
      const response = await api.markAllRead()
      setNotice(response.message || 'All notifications marked as read.')
      await refreshNotifications()
    } catch (actionError) {
      setError(actionError.message || 'Notifications could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  async function removeNotification(event, notificationId) {
    event.stopPropagation()
    setError('')

    try {
      await api.dismiss(notificationId)
      setNotifications((current) => current.filter((item) => item.id !== notificationId))
      await refreshSummary()
    } catch (actionError) {
      setError(actionError.message || 'The notification could not be removed.')
    }
  }

  async function clearRead() {
    setSaving(true)
    setError('')

    try {
      const response = await api.clearRead()
      setNotice(response.message || 'Read notifications cleared.')
      await refreshNotifications()
    } catch (actionError) {
      setError(actionError.message || 'Read notifications could not be cleared.')
    } finally {
      setSaving(false)
    }
  }

  async function savePreferences(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await api.savePreferences(preferences)
      setPreferences(response.preferences || preferences)
      setNotice(response.message || 'Notification preferences saved.')
    } catch (saveError) {
      setError(saveError.message || 'Notification preferences could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`pwc-notification-center is-${mode}`}>
      <button
        ref={triggerRef}
        className="pwc-notification-trigger"
        type="button"
        aria-label={`${isClient ? 'Updates' : 'Alerts'}${summary.unread ? `, ${summary.unread} unread` : ''}`}
        aria-controls={dialogId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
          setView('notifications')
          setNotice('')
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span>{isClient ? 'Updates' : 'Alerts'}</span>
        {Number(summary.unread || 0) > 0 && (
          <em className={Number(summary.importantUnread || 0) > 0 ? 'is-important' : ''}>
            {Number(summary.unread) > 99 ? '99+' : summary.unread}
          </em>
        )}
      </button>

      {open && createPortal(
        <div className={`pwc-notification-overlay is-${mode}`} role="presentation" onMouseDown={() => closeCenter()}>
          <aside
            ref={drawerRef}
            id={dialogId}
            className={`pwc-notification-drawer is-${mode}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-summary`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Power Within</p>
                <h2 id={`${dialogId}-title`}>{isClient ? 'Your Updates' : 'Notification Center'}</h2>
                <span id={`${dialogId}-summary`}>{summary.unread ? `${summary.unread} unread update${summary.unread === 1 ? '' : 's'}` : 'You are all caught up'}</span>
              </div>
              <button ref={closeButtonRef} type="button" aria-label="Close updates" onClick={() => closeCenter()}>×</button>
            </header>

            <div className="pwc-notification-tabs" role="tablist" aria-label="Notification Center views">
              <button
                id={`${dialogId}-updates-tab`}
                type="button"
                role="tab"
                aria-controls={notificationPanelId}
                aria-selected={view === 'notifications'}
                className={view === 'notifications' ? 'is-active' : ''}
                onClick={() => setView('notifications')}
                onKeyDown={switchViewWithKeyboard}
              >
                Updates
              </button>
              <button
                id={`${dialogId}-preferences-tab`}
                type="button"
                role="tab"
                aria-controls={preferencePanelId}
                aria-selected={view === 'preferences'}
                className={view === 'preferences' ? 'is-active' : ''}
                onClick={() => setView('preferences')}
                onKeyDown={switchViewWithKeyboard}
              >
                Preferences
              </button>
            </div>

            {(error || notice) && (
              <div className={`pwc-notification-message${error ? ' is-error' : ''}`} role="status">
                {error || notice}
              </div>
            )}

            {view === 'preferences' ? (
              <form
                id={preferencePanelId}
                className="pwc-notification-preferences"
                role="tabpanel"
                aria-labelledby={`${dialogId}-preferences-tab`}
                onSubmit={savePreferences}
              >
                <label className="pwc-notification-email-toggle">
                  <div>
                    <strong>Email notifications</strong>
                    <span>In-app alerts always remain available. Turn this on to also receive selected updates by email.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={(event) => setPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))}
                  />
                </label>

                <fieldset disabled={!preferences.emailEnabled || loading || saving}>
                  <legend>Email me about</legend>
                  {categories.filter(([key]) => key !== 'all').map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(preferences.emailCategories[key])}
                        onChange={(event) => setPreferences((current) => ({
                          ...current,
                          emailCategories: {
                            ...current.emailCategories,
                            [key]: event.target.checked,
                          },
                        }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>

                <button className="pwc-notification-save" type="submit" disabled={loading || saving}>
                  {saving ? 'Saving…' : 'Save Preferences'}
                </button>
              </form>
            ) : (
              <div
                id={notificationPanelId}
                className="pwc-notification-updates"
                role="tabpanel"
                aria-labelledby={`${dialogId}-updates-tab`}
              >
                <div className="pwc-notification-tools">
                  <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter notifications">
                    {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <label><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only</label>
                </div>

                <div className="pwc-notification-actions">
                  {!isClient && <button type="button" onClick={openFullActivity}>Open activity center</button>}
                  <button type="button" onClick={markAllRead} disabled={saving || !summary.unread}>Mark all read</button>
                  <button type="button" onClick={clearRead} disabled={saving}>Clear read</button>
                </div>

                <div className="pwc-notification-list">
                  {loading ? (
                    <p className="pwc-notification-empty">Gathering your updates…</p>
                  ) : notifications.length === 0 ? (
                    <p className="pwc-notification-empty">No notifications match this view.</p>
                  ) : notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`${notification.readAt ? '' : 'is-unread'} is-${notification.importance}`}
                    >
                      <div className="pwc-notification-item-top">
                        <span>{categoryLabel(notification.category)}</span>
                        <time>{formatTime(notification.createdAt)}</time>
                        <button type="button" aria-label="Remove notification" onClick={(event) => removeNotification(event, notification.id)}>×</button>
                      </div>
                      <button
                        className="pwc-notification-open"
                        type="button"
                        aria-label={`${notification.readAt ? 'Open' : 'Read'} update: ${notification.title}`}
                        onClick={() => openNotification(notification)}
                      >
                        <h3>{notification.title}</h3>
                        <p>{notification.body}</p>
                        {notification.actionLabel && <strong>{notification.actionLabel} →</strong>}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
