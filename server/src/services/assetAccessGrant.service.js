const crypto = require('crypto')

const allowedPurposes = new Set(['download', 'preview'])

function encode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function hashGrantToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function grantError(message = 'This asset access link is invalid or expired.') {
  const error = new Error(message)
  error.statusCode = 401
  return error
}

function createSignedGrant({
  grantId = crypto.randomUUID(),
  assetId,
  actorUserId = null,
  clientProfileId = null,
  purpose = 'download',
  ttlSeconds = 300,
  secret,
  now = new Date(),
}) {
  if (!assetId || !secret || !allowedPurposes.has(purpose)) throw grantError('Unable to create this asset access link.')

  const issuedAt = Math.floor(now.getTime() / 1000)
  const ttl = Math.min(Math.max(Number(ttlSeconds) || 300, 30), 900)
  const payload = {
    v: 1,
    jti: grantId,
    assetId,
    actorUserId,
    clientProfileId,
    purpose,
    iat: issuedAt,
    exp: issuedAt + ttl,
  }
  const encodedPayload = encode(payload)
  const token = `${encodedPayload}.${sign(encodedPayload, secret)}`

  return {
    grantId,
    token,
    tokenHash: hashGrantToken(token),
    expiresAt: new Date(payload.exp * 1000),
    payload,
  }
}

function verifySignedGrant(token, { secret, purpose, now = new Date() }) {
  const [encodedPayload, suppliedSignature, extra] = String(token || '').split('.')
  if (!encodedPayload || !suppliedSignature || extra || !secret) throw grantError()

  const expectedSignature = sign(encodedPayload, secret)
  const expectedBuffer = Buffer.from(expectedSignature)
  const suppliedBuffer = Buffer.from(suppliedSignature)
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) throw grantError()

  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw grantError()
  }

  const nowSeconds = Math.floor(now.getTime() / 1000)
  if (payload.v !== 1 || !payload.jti || !payload.assetId || !allowedPurposes.has(payload.purpose)) throw grantError()
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) throw grantError('This asset access link has expired.')
  if (purpose && payload.purpose !== purpose) throw grantError('This asset access link cannot be used for that action.')

  return payload
}

module.exports = {
  allowedPurposes,
  createSignedGrant,
  hashGrantToken,
  verifySignedGrant,
}
