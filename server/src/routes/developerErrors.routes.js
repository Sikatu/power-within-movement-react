const express = require('express')
const { z } = require('zod')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  deleteError,
  getErrorById,
  getErrorCenterPersistenceHealth,
  getErrorCenterSettings,
  getErrorSummary,
  listErrors,
  runAllErrorChecks,
  saveErrorCenterSettings,
  updateErrorStatus,
  captureApplicationError,
} = require('../services/developerErrorCenter.service')

const router = express.Router()
router.use(requireAuth, requireRole(['developer']))

const statusSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'ignored']),
})

const settingsSchema = z.object({
  enabled: z.boolean(),
  frontendCaptureEnabled: z.boolean(),
  uptimeChecksEnabled: z.boolean(),
  criticalNotificationsEnabled: z.boolean(),
  retentionDays: z.coerce.number().int().min(7).max(365),
  uptimeIntervalMinutes: z.coerce.number().int().min(1).max(60),
  slowResponseThresholdMs: z.coerce.number().int().min(500).max(30000),
})

router.get('/summary', async (req, res, next) => {
  try {
    const [summary, settings, persistence] = await Promise.all([
      getErrorSummary(),
      getErrorCenterSettings(),
      getErrorCenterPersistenceHealth(),
    ])
    res.json({ ok: true, summary, settings, persistence })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const errors = await listErrors(req.query)
    res.json({ ok: true, errors })
  } catch (error) {
    next(error)
  }
})

router.get('/settings', async (req, res, next) => {
  try {
    res.json({ ok: true, settings: await getErrorCenterSettings() })
  } catch (error) {
    next(error)
  }
})

router.put('/settings', async (req, res, next) => {
  try {
    const payload = settingsSchema.parse(req.body || {})
    const settings = await saveErrorCenterSettings(payload, req.user.id)
    res.json({ ok: true, settings, message: 'Error Center settings saved.' })
  } catch (error) {
    next(error)
  }
})

router.post('/run-checks', async (req, res, next) => {
  try {
    const result = await runAllErrorChecks()
    res.json({ ok: true, result, message: 'Production checks completed.' })
  } catch (error) {
    next(error)
  }
})

router.post('/test', async (req, res, next) => {
  try {
    const error = await captureApplicationError({
      source: 'backend',
      severity: 'low',
      title: 'Developer Error Center test event',
      message: 'This safe test confirms that production error capture is operational.',
      route: '/api/admin/developer/errors/test',
      method: 'POST',
      userId: req.user.id,
      userRole: req.user.role,
      requestId: req.requestId,
      metadata: { safeTest: true },
    })
    res.json({ ok: true, error: error ? { id: error.id } : null, message: 'Test error recorded.' })
  } catch (error) {
    next(error)
  }
})

router.get('/:errorId', async (req, res, next) => {
  try {
    const error = await getErrorById(req.params.errorId)
    if (!error) return res.status(404).json({ ok: false, error: 'Error record not found.' })
    res.json({ ok: true, error })
  } catch (error) {
    next(error)
  }
})

router.patch('/:errorId/status', async (req, res, next) => {
  try {
    const payload = statusSchema.parse(req.body || {})
    const error = await updateErrorStatus(req.params.errorId, payload.status, req.user.id)
    if (!error) return res.status(404).json({ ok: false, error: 'Error record not found.' })
    res.json({ ok: true, error, message: 'Error status updated.' })
  } catch (error) {
    next(error)
  }
})

router.delete('/:errorId', async (req, res, next) => {
  try {
    const deleted = await deleteError(req.params.errorId)
    if (!deleted) return res.status(404).json({ ok: false, error: 'Error record not found.' })
    res.json({ ok: true, message: 'Error record deleted.' })
  } catch (error) {
    next(error)
  }
})

module.exports = router
