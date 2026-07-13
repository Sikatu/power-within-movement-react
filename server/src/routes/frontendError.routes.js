const express = require('express')
const { z } = require('zod')
const { captureApplicationError } = require('../services/developerErrorCenter.service')
const {
  frontendErrorReportRateLimit,
} = require('../middleware/securityRateLimits.middleware')

const router = express.Router()

const frontendErrorSchema = z.object({
  type: z.enum(['javascript', 'promise', 'react', 'api', 'asset', 'network']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  title: z.string().trim().max(250).optional(),
  message: z.string().trim().min(1).max(6000),
  stack: z.string().max(20000).optional(),
  route: z.string().max(500).optional(),
  method: z.string().max(12).optional(),
  httpStatus: z.coerce.number().int().min(0).max(599).nullable().optional(),
  buildVersion: z.string().max(120).optional(),
  browser: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional().refine(
    (value) => !value || JSON.stringify(value).length <= 5000,
    'Error metadata is too large.',
  ),
})

router.post('/', frontendErrorReportRateLimit, async (req, res, next) => {
  try {
    const payload = frontendErrorSchema.parse(req.body || {})
    const source = payload.type === 'asset' ? 'asset' : payload.type === 'api' ? 'api' : 'frontend'

    await captureApplicationError({
      source,
      severity: payload.severity || (payload.httpStatus >= 500 ? 'high' : 'medium'),
      title: payload.title || 'Frontend application error',
      message: payload.message,
      stackTrace: payload.stack,
      route: payload.route,
      method: payload.method,
      httpStatus: payload.httpStatus,
      buildVersion: payload.buildVersion,
      browser: payload.browser || req.headers['user-agent'],
      requestId: req.requestId,
      metadata: {
        ...(payload.metadata || {}),
        reportType: payload.type || 'javascript',
      },
    })

    res.status(202).json({ ok: true })
  } catch (error) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid frontend error report.' })
    }
    return next(error)
  }
})

module.exports = router
