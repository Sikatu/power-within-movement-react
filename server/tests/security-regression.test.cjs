const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { errorHandler } = require('../src/middleware/error.middleware')

function responseRecorder() {
  return {
    locals: {},
    statusCode: null,
    body: null,
    status(value) {
      this.statusCode = value
      return this
    },
    json(value) {
      this.body = value
      return this
    },
  }
}

test('production-style server errors do not expose internal messages', () => {
  const response = responseRecorder()
  const request = {
    originalUrl: '/api/private',
    method: 'GET',
    headers: {},
    requestId: 'security-test',
  }

  errorHandler(
    Object.assign(new Error('password authentication failed for database user'), {
      statusCode: 500,
    }),
    request,
    response,
    () => {},
  )

  assert.equal(response.statusCode, 500)
  assert.equal(response.body.error, 'An unexpected server error occurred.')
  assert.equal(response.body.requestId, 'security-test')
})

test('safe client errors retain their useful message', () => {
  const response = responseRecorder()
  errorHandler(
    Object.assign(new Error('A valid email is required.'), { statusCode: 400 }),
    { originalUrl: '/api/test', method: 'POST', headers: {} },
    response,
    () => {},
  )

  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error, 'A valid email is required.')
})

test('known plaintext client reset script is not shipped', () => {
  const resetScript = path.join(__dirname, '..', 'scripts', 'dev-reset-cherry-portal-password.cjs')
  assert.equal(fs.existsSync(resetScript), false)
})

test('admin login relies on the HTTP-only cookie instead of returning the JWT', () => {
  const authSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'),
    'utf8',
  )

  assert.doesNotMatch(authSource, /user:\s*publicUser\(refreshedUser\),\s*token\s*[,}]/)
})

test('Developer Error Center migration repairs legacy fingerprint uniqueness', () => {
  const migrationSource = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'ensure-developer-error-center.cjs'),
    'utf8',
  )

  assert.match(migrationSource, /pwc_application_error_fingerprint_repair/)
  assert.match(migrationSource, /UNIQUE \(fingerprint\)/)
})
