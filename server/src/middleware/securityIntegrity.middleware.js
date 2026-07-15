const { env } = require('../config/env')
const {
  evaluateTrustedMutation,
  normalizeOrigin,
} = require('./securityRequestPolicy')

function requestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
  const protocol = forwardedProto || req.protocol || 'http'
  const host = req.get?.('host') || req.headers.host

  return host ? normalizeOrigin(`${protocol}://${host}`) : ''
}

function sensitiveResponseHeaders(req, res, next) {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  })
  res.vary('Origin')
  next()
}

function enforceTrustedMutation(req, res, next) {
  const decision = evaluateTrustedMutation({
    method: req.method,
    authorization: req.headers.authorization,
    origin: req.headers.origin,
    referer: req.headers.referer,
    allowedOrigins: env.clientOrigins,
    currentOrigin: requestOrigin(req),
    isProduction: env.isProduction,
  })

  if (!decision.allowed) {
    return res.status(403).json({
      ok: false,
      code: 'TRUSTED_ORIGIN_REQUIRED',
      error: 'This protected request did not originate from an approved Power Within application.',
    })
  }

  req.trustedMutationMode = decision.reason
  return next()
}

module.exports = {
  enforceTrustedMutation,
  sensitiveResponseHeaders,
}
