const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const { Readable } = require('stream')
const { env } = require('../config/env')

const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
])

const previewableMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'text/plain',
  'text/csv',
])

function safeSegment(value, fallback = 'file') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

  return normalized || fallback
}

function getExtension(fileName) {
  const extension = path.extname(String(fileName || '')).replace('.', '').toLowerCase()
  return extension.slice(0, 15)
}

function buildStorageKey(fileName) {
  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const id = crypto.randomUUID()
  return `${year}/${month}/${id}-${safeSegment(fileName)}`
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function getUploadLimit() {
  return Number(env.assetMaxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES)
}

function validateUpload({ fileName, mimeType, sizeBytes }) {
  const errors = []
  const normalizedMime = String(mimeType || 'application/octet-stream').toLowerCase()
  const normalizedSize = Number(sizeBytes || 0)

  if (!fileName || String(fileName).length > 240) errors.push('A valid filename is required.')
  if (!allowedMimeTypes.has(normalizedMime)) errors.push(`Files of type ${normalizedMime} are not supported.`)
  if (!Number.isFinite(normalizedSize) || normalizedSize <= 0) errors.push('The uploaded file is empty.')
  if (normalizedSize > getUploadLimit()) errors.push(`The file exceeds the ${Math.round(getUploadLimit() / 1024 / 1024)} MB upload limit.`)

  return {
    ok: errors.length === 0,
    errors,
    mimeType: normalizedMime,
    sizeBytes: normalizedSize,
  }
}

async function ensureLocalRoot() {
  await fs.mkdir(env.assetStorageDir, { recursive: true })
}

function localPathForKey(storageKey) {
  const normalized = path.normalize(storageKey).replace(/^([/\\])+/, '')
  const absolute = path.resolve(env.assetStorageDir, normalized)
  const root = path.resolve(env.assetStorageDir)

  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error('Invalid asset storage key.')
  }

  return absolute
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function awsDateParts(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  }
}

function encodeS3Path(value) {
  return String(value)
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%2F/g, '/'))
    .join('/')
}

function buildS3Url(storageKey) {
  const endpoint = new URL(env.assetS3Endpoint)
  const encodedKey = encodeS3Path(storageKey)

  if (env.assetS3ForcePathStyle) {
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(env.assetS3Bucket)}/${encodedKey}`
  } else {
    endpoint.hostname = `${env.assetS3Bucket}.${endpoint.hostname}`
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodedKey}`
  }

  return endpoint
}

function signS3Request({ method, url, payloadHash, contentType, date = new Date() }) {
  const { amzDate, dateStamp } = awsDateParts(date)
  const region = env.assetS3Region || 'us-east-1'
  const service = 's3'
  const host = url.host
  const canonicalUri = url.pathname
  const canonicalQueryString = url.searchParams.toString()
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  if (contentType) headers['content-type'] = contentType

  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${String(headers[name]).trim()}\n`).join('')
  const signedHeaders = signedHeaderNames.join(';')
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')
  const dateKey = hmac(`AWS4${env.assetS3SecretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, service)
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = hmac(signingKey, stringToSign, 'hex')

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${env.assetS3AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

function assertS3Configured() {
  const missing = [
    ['ASSET_S3_ENDPOINT', env.assetS3Endpoint],
    ['ASSET_S3_BUCKET', env.assetS3Bucket],
    ['ASSET_S3_ACCESS_KEY_ID', env.assetS3AccessKeyId],
    ['ASSET_S3_SECRET_ACCESS_KEY', env.assetS3SecretAccessKey],
  ].filter(([, value]) => !value)

  if (missing.length) {
    throw new Error(`S3 asset storage is missing: ${missing.map(([name]) => name).join(', ')}.`)
  }
}

async function s3Request({ method, storageKey, buffer, contentType }) {
  assertS3Configured()
  const url = buildS3Url(storageKey)
  const body = buffer || undefined
  const payloadHash = buffer ? hashBuffer(buffer) : sha256('')
  const headers = signS3Request({ method, url, payloadHash, contentType })
  const response = await fetch(url, { method, headers, body })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Object storage request failed (${response.status}). ${detail.slice(0, 300)}`.trim())
  }

  return response
}

async function writeObject({ storageKey, buffer, mimeType }) {
  if (env.assetStorageDriver === 's3') {
    await s3Request({ method: 'PUT', storageKey, buffer, contentType: mimeType })
    return
  }

  await ensureLocalRoot()
  const targetPath = localPathForKey(storageKey)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, buffer, { flag: 'wx' })
}

async function readObject(input) {
  const storageDriver = input.storageDriver || input.storage_driver
  const storageKey = input.storageKey || input.storage_key
  if (storageDriver === 's3') {
    const response = await s3Request({ method: 'GET', storageKey })
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  return fs.readFile(localPathForKey(storageKey))
}

async function getObjectStream(input) {
  const storageDriver = input.storageDriver || input.storage_driver
  const storageKey = input.storageKey || input.storage_key
  if (storageDriver === 's3') {
    const response = await s3Request({ method: 'GET', storageKey })
    if (!response.body) throw new Error('Object storage returned an empty response.')
    return Readable.fromWeb(response.body)
  }

  return require('fs').createReadStream(localPathForKey(storageKey))
}

function canPreviewAsset(input) {
  return previewableMimeTypes.has(String(input?.mime_type || input?.mimeType || '').toLowerCase())
}

async function deleteObject(input) {
  const storageDriver = input.storageDriver || input.storage_driver
  const storageKey = input.storageKey || input.storage_key
  if (storageDriver === 's3') {
    await s3Request({ method: 'DELETE', storageKey })
    return
  }

  await fs.rm(localPathForKey(storageKey), { force: true })
}

async function writeUploadedAsset({ fileName, mimeType, buffer }) {
  const validation = validateUpload({ fileName, mimeType, sizeBytes: buffer.length })
  if (!validation.ok) {
    const error = new Error(validation.errors[0])
    error.statusCode = 400
    throw error
  }

  const storageKey = buildStorageKey(fileName)
  await writeObject({ storageKey, buffer, mimeType: validation.mimeType })

  return {
    storageDriver: env.assetStorageDriver,
    storageKey,
    originalFilename: String(fileName),
    fileExtension: getExtension(fileName),
    mimeType: validation.mimeType,
    sizeBytes: buffer.length,
    checksumSha256: hashBuffer(buffer),
  }
}

async function collectRequestBuffer(req) {
  const maxBytes = getUploadLimit()
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) {
      const error = new Error(`The file exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`)
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

function bufferToStream(buffer) {
  return Readable.from(buffer)
}

function getStorageStatus() {
  return {
    driver: env.assetStorageDriver,
    maxUploadBytes: getUploadLimit(),
    configured: env.assetStorageDriver === 'local'
      ? Boolean(env.assetStorageDir)
      : Boolean(env.assetS3Endpoint && env.assetS3Bucket && env.assetS3AccessKeyId && env.assetS3SecretAccessKey),
    privateDelivery: 'authenticated_proxy',
    accessGrants: 'short_lived_scoped',
    malwareScanner: env.assetMalwareScanner,
  }
}

module.exports = {
  allowedMimeTypes,
  bufferToStream,
  canPreviewAsset,
  collectRequestBuffer,
  deleteObject,
  getStorageStatus,
  getObjectStream,
  previewableMimeTypes,
  readObject,
  safeSegment,
  validateUpload,
  writeUploadedAsset,
}
