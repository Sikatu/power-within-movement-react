const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function normalizeOrigin(value) {
  if (!value) return ''

  try {
    return new URL(String(value)).origin
  } catch {
    return ''
  }
}

function evaluateTrustedMutation({
  method,
  authorization,
  origin,
  referer,
  allowedOrigins = [],
  currentOrigin = '',
  isProduction = false,
}) {
  const normalizedMethod = String(method || 'GET').toUpperCase()

  if (SAFE_METHODS.has(normalizedMethod)) {
    return { allowed: true, reason: 'safe_method' }
  }

  if (/^Bearer\s+\S+/i.test(String(authorization || ''))) {
    return { allowed: true, reason: 'bearer_token' }
  }

  const suppliedOrigin = normalizeOrigin(origin) || normalizeOrigin(referer)
  const trustedOrigins = new Set(
    [...allowedOrigins, currentOrigin]
      .map(normalizeOrigin)
      .filter(Boolean),
  )

  if (suppliedOrigin) {
    return trustedOrigins.has(suppliedOrigin)
      ? { allowed: true, reason: 'trusted_origin', suppliedOrigin }
      : { allowed: false, reason: 'origin_mismatch', suppliedOrigin }
  }

  if (!isProduction) {
    return { allowed: true, reason: 'development_without_origin' }
  }

  return { allowed: false, reason: 'origin_required' }
}

module.exports = {
  SAFE_METHODS,
  evaluateTrustedMutation,
  normalizeOrigin,
}
