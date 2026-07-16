require('dotenv').config()

const DEFAULT_DEV_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
]
const DEFAULT_DEV_CLIENT_ORIGIN = DEFAULT_DEV_CLIENT_ORIGINS[0]
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

function parseBoundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback
}

function normalizeSameSite(value, fallback) {
  const normalized = String(value || fallback || 'lax').trim().toLowerCase()
  const allowed = new Set(['lax', 'strict', 'none'])

  return allowed.has(normalized) ? normalized : 'lax'
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

const configuredClientOrigins = parseCsv(
  process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN,
  [DEFAULT_DEV_CLIENT_ORIGIN],
)
const clientOrigins = isProduction
  ? configuredClientOrigins
  : [...new Set([...DEFAULT_DEV_CLIENT_ORIGINS, ...configuredClientOrigins])]

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
  newsletterEmailFrom: process.env.NEWSLETTER_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || process.env.PORTAL_EMAIL_FROM || '',
  newsletterReplyTo: process.env.NEWSLETTER_REPLY_TO || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  publicApiUrl: process.env.PUBLIC_API_URL || process.env.PUBLIC_SITE_URL || clientOrigins[0] || DEFAULT_DEV_CLIENT_ORIGIN,
  letterSigningSecret: process.env.LETTER_SIGNING_SECRET || jwtSecret,
  letterSendConcurrency: parseBoundedNumber(process.env.LETTER_SEND_CONCURRENCY, 1, 1, 5),
  letterSendBatchDelayMs: parseBoundedNumber(process.env.LETTER_SEND_BATCH_DELAY_MS, 550, 0, 5000),

  assetStorageDriver: String(process.env.ASSET_STORAGE_DRIVER || 'local').trim().toLowerCase() === 's3' ? 's3' : 'local',
  assetStorageDir: process.env.ASSET_STORAGE_DIR || require('path').resolve(__dirname, '..', '..', 'storage', 'assets'),
  assetMaxUploadBytes: Number(process.env.ASSET_MAX_UPLOAD_BYTES || 50 * 1024 * 1024),
  assetS3Endpoint: process.env.ASSET_S3_ENDPOINT || '',
  assetS3Region: process.env.ASSET_S3_REGION || 'us-east-1',
  assetS3Bucket: process.env.ASSET_S3_BUCKET || '',
  assetS3AccessKeyId: process.env.ASSET_S3_ACCESS_KEY_ID || '',
  assetS3SecretAccessKey: process.env.ASSET_S3_SECRET_ACCESS_KEY || '',
  assetS3ForcePathStyle: parseBoolean(process.env.ASSET_S3_FORCE_PATH_STYLE, true),
  assetAccessGrantSecret: process.env.ASSET_ACCESS_GRANT_SECRET || jwtSecret,
  assetAccessGrantTtlSeconds: Math.min(Math.max(Number(process.env.ASSET_ACCESS_GRANT_TTL_SECONDS || 300), 30), 900),
  assetMalwareScanner: String(process.env.ASSET_MALWARE_SCANNER || 'disabled').trim().toLowerCase(),

  canonicalDeveloperEmail:
    process.env.CANONICAL_DEVELOPER_EMAIL || 'darelle.grande.mva@gmail.com',
  canonicalOwnerEmail:
    process.env.CANONICAL_OWNER_EMAIL || 'hello@powerwithinmovement.com',
}

module.exports = { env }
