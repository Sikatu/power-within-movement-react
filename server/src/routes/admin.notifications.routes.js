const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  DEFAULT_EMAIL_CATEGORIES,
  dismissNotification,
  dismissReadNotifications,
  getNotificationPreferences,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
} = require('../services/notificationCenter.service')
const {
  enforceTeamClientAssignment,
  enforceTeamPermission,
} = require('../services/teamManagement.service')

const router = express.Router()

const requireAdmin = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  enforceTeamClientAssignment,
]

const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailCategories: z
    .object({
      inbox: z.boolean(),
      sessions: z.boolean(),
      resources: z.boolean(),
      learning: z.boolean(),
      memberships: z.boolean(),
      encouragements: z.boolean(),
      community: z.boolean(),
      system: z.boolean(),
    })
    .default(DEFAULT_EMAIL_CATEGORIES),
})

router.get('/notifications/summary', requireAdmin, async (req, res, next) => {
  try {
    return res.json({ ok: true, summary: await getNotificationSummary(req.user.id) })
  } catch (error) {
    return next(error)
  }
})

router.get('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const result = await listNotifications(req.user.id, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly === 'true',
      category: req.query.category,
    })
    return res.json({ ok: true, ...result })
  } catch (error) {
    return next(error)
  }
})

router.patch('/notifications/:notificationId/read', requireAdmin, async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.notificationId)
    if (!notification) {
      return res.status(404).json({ ok: false, error: 'Notification not found.' })
    }
    return res.json({ ok: true, notification })
  } catch (error) {
    return next(error)
  }
})

router.post('/notifications/mark-all-read', requireAdmin, async (req, res, next) => {
  try {
    const updated = await markAllNotificationsRead(req.user.id)
    return res.json({
      ok: true,
      updated,
      message: updated
        ? 'All notifications marked as read.'
        : 'No unread notifications remained.',
    })
  } catch (error) {
    return next(error)
  }
})

router.delete('/notifications/:notificationId', requireAdmin, async (req, res, next) => {
  try {
    const dismissed = await dismissNotification(req.user.id, req.params.notificationId)
    if (!dismissed) {
      return res.status(404).json({ ok: false, error: 'Notification not found.' })
    }
    return res.json({ ok: true, message: 'Notification removed.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/notifications/clear-read', requireAdmin, async (req, res, next) => {
  try {
    const dismissed = await dismissReadNotifications(req.user.id)
    return res.json({
      ok: true,
      dismissed,
      message: dismissed
        ? 'Read notifications cleared.'
        : 'No read notifications needed clearing.',
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/notifications/preferences', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      preferences: await getNotificationPreferences(req.user.id),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/notifications/preferences', requireAdmin, async (req, res, next) => {
  const parsed = notificationPreferencesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the notification preferences.',
    })
  }

  try {
    const preferences = await saveNotificationPreferences(req.user.id, parsed.data)
    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data, ip_address, user_agent)
       VALUES ($1, 'notification_preferences_updated', 'system_users', $1, $2::jsonb, $3, $4)`,
      [req.user.id, JSON.stringify(preferences), req.ip || null, req.get('user-agent') || null],
    )
    return res.json({
      ok: true,
      message: 'Notification preferences saved.',
      preferences,
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
