require('dotenv').config()

const DEFAULT_DEV_CLIENT_ORIGIN = 'http://localhost:5173'
const DEFAULT_DEV_JWT_SECRET = 'change-this-dev-secret-before-production'

function parseCsv(value, fallback = []) {
  const parsed = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return parsed.length > 0 ? parsed : fallback
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback

  const normalized = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false

  return fallback
}

function normalizeSameSite(value, fallback) {
  const normalized = String(value || fallback || 'lax').trim().toLowerCase()
  const allowed = new Set(['lax', 'strict', 'none'])

  return allowed.has(normalized) ? normalized : 'lax'
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

const clientOrigins = parseCsv(
  process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN,
  [DEFAULT_DEV_CLIENT_ORIGIN],
)

const jwtSecret = process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET

const cookieSameSite = normalizeSameSite(
  process.env.COOKIE_SAMESITE,
  isProduction ? 'none' : 'lax',
)

const cookieSecure = parseBoolean(
  process.env.COOKIE_SECURE,
  isProduction || cookieSameSite === 'none',
)

if (isProduction && jwtSecret === DEFAULT_DEV_JWT_SECRET) {
  throw new Error(
    'Production JWT_SECRET is not configured. Set a strong JWT_SECRET before deploying.',
  )
}

if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true.')
}

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 8787),

  clientOrigin: clientOrigins[0],
  clientOrigins,

  publicSiteUrl:
    process.env.PUBLIC_SITE_URL ||
    process.env.CLIENT_APP_URL ||
    clientOrigins[0] ||
    DEFAULT_DEV_CLIENT_ORIGIN,

  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret,

  cookieSecure,
  cookieSameSite,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  resendApiKey: process.env.RESEND_API_KEY || '',
  portalEmailFrom: process.env.PORTAL_EMAIL_FROM || '',
}

module.exports = { env }