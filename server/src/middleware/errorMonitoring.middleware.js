const crypto = require('crypto')
const { captureApplicationError } = require('../services/developerErrorCenter.service')

function requestErrorContext(req, res, next) {
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 100)
  const startedAt = Date.now()

  req.requestId = requestId
  res.setHeader('x-request-id', requestId)

  res.on('finish', () => {
    if (res.statusCode < 500 || res.locals.errorRecorded) return
    if (req.originalUrl?.startsWith('/api/public/error-reports')) return

    captureApplicationError({
      source: 'api',
      severity: res.statusCode >= 503 ? 'critical' : 'high',
      title: `HTTP ${res.statusCode} response`,
      message: `${req.method} ${req.originalUrl?.split('?')[0] || req.path} returned HTTP ${res.statusCode}.`,
      route: req.originalUrl,
      method: req.method,
      httpStatus: res.statusCode,
      requestId,
      userId: req.user?.id,
      userRole: req.user?.role,
      browser: req.headers['user-agent'],
      metadata: {
        durationMs: Date.now() - startedAt,
      },
    }).catch(() => {})
  })

  next()
}

module.exports = { requestErrorContext }
