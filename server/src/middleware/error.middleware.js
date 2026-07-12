const { captureApplicationError } = require('../services/developerErrorCenter.service')

function notFound(req, res, next) {
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.originalUrl,
  })
}

function errorHandler(error, req, res, next) {
  console.error(error)

  const status = Number(error.status || error.statusCode || 500)

  if (status >= 500) {
    res.locals.errorRecorded = true
    captureApplicationError({
      source: error.code && String(error.code).startsWith('42') ? 'database' : 'backend',
      severity: status >= 503 ? 'critical' : 'high',
      title: error.code ? `Backend error ${error.code}` : 'Unhandled backend request error',
      message: error.message || 'Internal server error',
      stackTrace: error.stack,
      route: req.originalUrl,
      method: req.method,
      httpStatus: status,
      requestId: req.requestId,
      userId: req.user?.id,
      userRole: req.user?.role,
      browser: req.headers['user-agent'],
      metadata: {
        databaseCode: error.code || null,
        databaseRoutine: error.routine || null,
      },
    }).catch(() => {})
  }

  res.status(status).json({
    ok: false,
    error: error.message || 'Internal server error',
    requestId: req.requestId || undefined,
  })
}

module.exports = {
  notFound,
  errorHandler,
}
