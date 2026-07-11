const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { getPlatformSettings } = require('./platformSettings.service')

const NOTIFICATION_CATEGORIES = [
  'inbox',
  'sessions',
  'resources',
  'learning',
  'memberships',
  'encouragements',
  'community',
  'system',
]

const DEFAULT_EMAIL_CATEGORIES = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((category) => [category, true]),
)

function normalizeNotificationPreferences(value = {}) {
  const incomingCategories = value.email_categories || value.emailCategories || {}

  return {
    emailEnabled: Boolean(value.email_enabled ?? value.emailEnabled),
    emailCategories: Object.fromEntries(
      NOTIFICATION_CATEGORIES.map((category) => [
        category,
        incomingCategories[category] === undefined
          ? DEFAULT_EMAIL_CATEGORIES[category]
          : Boolean(incomingCategories[category]),
      ]),
    ),
  }
}

async function getNotificationPreferences(userId, db = pool) {
  if (!db || !userId) {
    return {
      userId: userId || null,
      ...normalizeNotificationPreferences(),
      createdAt: null,
      updatedAt: null,
    }
  }

  const result = await db.query(
    `
    SELECT user_id, email_enabled, email_categories, created_at, updated_at
    FROM notification_preferences
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )

  const row = result.rows[0]

  return {
    userId,
    ...normalizeNotificationPreferences(row || {}),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  }
}

async function saveNotificationPreferences(userId, value, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const normalized = normalizeNotificationPreferences(value)
  const result = await db.query(
    `
    INSERT INTO notification_preferences (
      user_id,
      email_enabled,
      email_categories
    )
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (user_id)
    DO UPDATE SET
      email_enabled = EXCLUDED.email_enabled,
      email_categories = EXCLUDED.email_categories,
      updated_at = now()
    RETURNING user_id, email_enabled, email_categories, created_at, updated_at
    `,
    [userId, normalized.emailEnabled, JSON.stringify(normalized.emailCategories)],
  )

  const row = result.rows[0]

  return {
    userId: row.user_id,
    ...normalizeNotificationPreferences(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serializeNotification(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    actionLabel: row.action_label,
    entityType: row.entity_type,
    entityId: row.entity_id,
    importance: row.importance,
    readAt: row.read_at,
    emailStatus: row.email_status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

async function listNotifications(userId, options = {}, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const requestedLimit = Number(options.limit || 40)
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 40, 1),
    100,
  )
  const unreadOnly = Boolean(options.unreadOnly)
  const category = NOTIFICATION_CATEGORIES.includes(options.category)
    ? options.category
    : null

  const result = await db.query(
    `
    SELECT
      id,
      category,
      title,
      body,
      action_url,
      action_label,
      entity_type,
      entity_id,
      importance,
      read_at,
      email_status,
      created_at,
      expires_at
    FROM notifications
    WHERE recipient_user_id = $1
      AND dismissed_at IS NULL
      AND expires_at > now()
      AND ($2::boolean = false OR read_at IS NULL)
      AND ($3::text IS NULL OR category = $3)
    ORDER BY
      CASE importance
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        ELSE 2
      END,
      created_at DESC
    LIMIT $4
    `,
    [userId, unreadOnly, category, limit],
  )

  const summary = await getNotificationSummary(userId, db)

  return {
    notifications: result.rows.map(serializeNotification),
    summary,
  }
}

async function getNotificationSummary(userId, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread,
      COUNT(*) FILTER (
        WHERE read_at IS NULL
          AND importance IN ('high', 'urgent')
      )::int AS important_unread
    FROM notifications
    WHERE recipient_user_id = $1
      AND dismissed_at IS NULL
      AND expires_at > now()
    `,
    [userId],
  )

  const row = result.rows[0] || {}

  return {
    total: Number(row.total || 0),
    unread: Number(row.unread || 0),
    importantUnread: Number(row.important_unread || 0),
  }
}

async function markNotificationRead(userId, notificationId, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(
    `
    UPDATE notifications
    SET read_at = COALESCE(read_at, now())
    WHERE id = $1
      AND recipient_user_id = $2
      AND dismissed_at IS NULL
    RETURNING *
    `,
    [notificationId, userId],
  )

  return result.rows[0] ? serializeNotification(result.rows[0]) : null
}

async function markAllNotificationsRead(userId, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(
    `
    UPDATE notifications
    SET read_at = now()
    WHERE recipient_user_id = $1
      AND read_at IS NULL
      AND dismissed_at IS NULL
      AND expires_at > now()
    `,
    [userId],
  )

  return result.rowCount
}

async function dismissNotification(userId, notificationId, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(
    `
    UPDATE notifications
    SET
      dismissed_at = now(),
      read_at = COALESCE(read_at, now())
    WHERE id = $1
      AND recipient_user_id = $2
      AND dismissed_at IS NULL
    RETURNING id
    `,
    [notificationId, userId],
  )

  return result.rowCount > 0
}

async function dismissReadNotifications(userId, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(
    `
    UPDATE notifications
    SET dismissed_at = now()
    WHERE recipient_user_id = $1
      AND read_at IS NOT NULL
      AND dismissed_at IS NULL
    `,
    [userId],
  )

  return result.rowCount
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function deliverPendingNotificationEmails(options = {}) {
  const db = options.db || pool
  const requestedBatchSize = Number(options.batchSize || 15)
  const batchSize = Math.min(
    Math.max(Number.isFinite(requestedBatchSize) ? requestedBatchSize : 15, 1),
    50,
  )

  if (!db || !env.resendApiKey || !env.portalEmailFrom) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const platformSettings = await getPlatformSettings(db)

  if (platformSettings.maintenanceMode || platformSettings.outgoingEmailPaused) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const result = await db.query(
    `
    SELECT
      n.id,
      n.title,
      n.body,
      n.action_url,
      n.action_label,
      n.email_attempts,
      u.email
    FROM notifications n
    JOIN system_users u
      ON u.id = n.recipient_user_id
    WHERE n.email_status = 'pending'
      AND n.dismissed_at IS NULL
      AND n.expires_at > now()
      AND u.status = 'active'
    ORDER BY n.created_at ASC
    LIMIT $1
    `,
    [batchSize],
  )

  let sent = 0
  let failed = 0

  for (const notification of result.rows) {
    const actionUrl = notification.action_url
      ? new URL(notification.action_url, env.publicSiteUrl).toString()
      : env.publicSiteUrl

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.portalEmailFrom,
          to: [notification.email],
          subject: notification.title,
          text: `${notification.body}\n\n${notification.action_label || 'Open Power Within'}: ${actionUrl}`,
          html: `
            <div style="font-family:Georgia,serif;line-height:1.6;color:#3d2730;max-width:620px;margin:0 auto;padding:24px;">
              <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8b6672;">Power Within</p>
              <h1 style="font-size:26px;line-height:1.25;">${escapeHtml(notification.title)}</h1>
              <p>${escapeHtml(notification.body)}</p>
              <p style="margin-top:28px;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#5f2938;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;">${escapeHtml(notification.action_label || 'Open Power Within')}</a></p>
              <p style="font-size:12px;color:#806f75;margin-top:30px;">You received this because email notifications are enabled in your Power Within account.</p>
            </div>
          `,
        }),
      })

      const responseBody = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseBody.message || `Resend returned ${response.status}.`)
      }

      await db.query(
        `
        UPDATE notifications
        SET
          email_status = 'sent',
          email_sent_at = now(),
          email_error = NULL,
          email_attempts = email_attempts + 1
        WHERE id = $1
        `,
        [notification.id],
      )
      sent += 1
    } catch (error) {
      const attempts = Number(notification.email_attempts || 0) + 1
      const finalFailure = attempts >= 3

      await db.query(
        `
        UPDATE notifications
        SET
          email_status = $2,
          email_error = $3,
          email_attempts = email_attempts + 1
        WHERE id = $1
        `,
        [
          notification.id,
          finalFailure ? 'failed' : 'pending',
          String(error.message || 'Notification email failed.').slice(0, 500),
        ],
      )
      failed += 1
    }
  }

  return {
    processed: result.rows.length,
    sent,
    skipped: 0,
    failed,
  }
}

async function cleanExpiredNotifications(db = pool) {
  if (!db) return 0

  const result = await db.query(
    `
    DELETE FROM notifications
    WHERE expires_at <= now()
       OR (dismissed_at IS NOT NULL AND dismissed_at < now() - interval '30 days')
    `,
  )

  return result.rowCount
}

function startNotificationEmailDispatcher() {
  if (!pool) return null

  let cycle = 0

  const run = async () => {
    cycle += 1

    if (env.resendApiKey && env.portalEmailFrom) {
      await deliverPendingNotificationEmails()
    }

    if (cycle === 1 || cycle % 1440 === 0) {
      await cleanExpiredNotifications()
    }
  }

  const initialTimer = setTimeout(() => {
    run().catch((error) => {
      console.error('Notification dispatcher failed:', error.message)
    })
  }, 10_000)

  const interval = setInterval(() => {
    run().catch((error) => {
      console.error('Notification dispatcher failed:', error.message)
    })
  }, 60_000)

  initialTimer.unref?.()
  interval.unref?.()

  return interval
}

module.exports = {
  DEFAULT_EMAIL_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  cleanExpiredNotifications,
  deliverPendingNotificationEmails,
  dismissNotification,
  dismissReadNotifications,
  getNotificationPreferences,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotificationPreferences,
  saveNotificationPreferences,
  startNotificationEmailDispatcher,
}
