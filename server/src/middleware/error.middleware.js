function notFound(req, res, next) {
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.originalUrl,
  })
}

function errorHandler(error, req, res, next) {
  console.error(error)

  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Internal server error',
  })
}

module.exports = {
  notFound,
  errorHandler,
}