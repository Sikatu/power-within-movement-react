import { useCallback, useEffect, useMemo, useState } from 'react'
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
      timeZone: 'America/New_York',
    }).format(new Date(value))
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
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

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

      setOpen(false)
      if (!notification.actionUrl) return

      if (notification.actionUrl.startsWith('/')) {
        navigate(notification.actionUrl)
      } else {
        window.location.assign(notification.actionUrl)
      }
    } catch (actionError) {
      setError(actionError.message || 'This notification could not be opened.')
    }
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
        className="pwc-notification-trigger"
        type="button"
        aria-label={`Notifications${summary.unread ? `, ${summary.unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
          setView('notifications')
          setNotice('')
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span>Alerts</span>
        {Number(summary.unread || 0) > 0 && (
          <em className={Number(summary.importantUnread || 0) > 0 ? 'is-important' : ''}>
            {Number(summary.unread) > 99 ? '99+' : summary.unread}
          </em>
        )}
      </button>

      {open && createPortal(
        <div className="pwc-notification-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <aside
            className="pwc-notification-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Notification Center"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Power Within</p>
                <h2>Notification Center</h2>
                <span>{summary.unread ? `${summary.unread} unread update${summary.unread === 1 ? '' : 's'}` : 'You are all caught up'}</span>
              </div>
              <button type="button" aria-label="Close Notification Center" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="pwc-notification-tabs" role="tablist">
              <button type="button" className={view === 'notifications' ? 'is-active' : ''} onClick={() => setView('notifications')}>Updates</button>
              <button type="button" className={view === 'preferences' ? 'is-active' : ''} onClick={() => setView('preferences')}>Preferences</button>
            </div>

            {(error || notice) && (
              <div className={`pwc-notification-message${error ? ' is-error' : ''}`} role="status">
                {error || notice}
              </div>
            )}

            {view === 'preferences' ? (
              <form className="pwc-notification-preferences" onSubmit={savePreferences}>
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
              <>
                <div className="pwc-notification-tools">
                  <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter notifications">
                    {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <label><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only</label>
                </div>

                <div className="pwc-notification-actions">
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
                      onClick={() => openNotification(notification)}
                    >
                      <div className="pwc-notification-item-top">
                        <span>{categoryLabel(notification.category)}</span>
                        <time>{formatTime(notification.createdAt)}</time>
                        <button type="button" aria-label="Remove notification" onClick={(event) => removeNotification(event, notification.id)}>×</button>
                      </div>
                      <h3>{notification.title}</h3>
                      <p>{notification.body}</p>
                      {notification.actionLabel && <strong>{notification.actionLabel} →</strong>}
                    </article>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
