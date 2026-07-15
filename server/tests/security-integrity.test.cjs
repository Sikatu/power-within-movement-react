const test = require('node:test')
const assert = require('node:assert/strict')

const {
  evaluateTrustedMutation,
} = require('../src/middleware/securityRequestPolicy')
const {
  buildIntegritySummary,
  buildSecurityIntegrityChecks,
} = require('../src/services/securityIntegritySignal')

const allowedOrigins = ['https://www.kimmittelstadt.com']

function evaluate(overrides = {}) {
  return evaluateTrustedMutation({
    method: 'POST',
    authorization: '',
    origin: '',
    referer: '',
    allowedOrigins,
    currentOrigin: 'https://api.kimmittelstadt.com',
    isProduction: true,
    ...overrides,
  })
}

test('safe requests bypass mutation-origin enforcement', () => {
  assert.equal(evaluate({ method: 'GET', origin: 'https://attacker.example' }).allowed, true)
})

test('cookie-authenticated mutation accepts an approved application origin', () => {
  const result = evaluate({ origin: 'https://www.kimmittelstadt.com' })
  assert.equal(result.allowed, true)
  assert.equal(result.reason, 'trusted_origin')
})

test('cookie-authenticated mutation rejects an unapproved production origin', () => {
  const result = evaluate({ origin: 'https://attacker.example' })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'origin_mismatch')
})

test('bearer-authenticated mutation can run without browser origin headers', () => {
  const result = evaluate({ authorization: 'Bearer test-token' })
  assert.equal(result.allowed, true)
  assert.equal(result.reason, 'bearer_token')
})

test('production cookie mutation requires an origin or referer', () => {
  const result = evaluate()
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'origin_required')
})

test('development tooling can omit origin headers', () => {
  const result = evaluate({ isProduction: false })
  assert.equal(result.allowed, true)
  assert.equal(result.reason, 'development_without_origin')
})

test('integrity summary escalates warnings and critical findings', () => {
  assert.equal(buildIntegritySummary([{ status: 'pass' }]).status, 'healthy')
  assert.equal(buildIntegritySummary([{ status: 'warning' }]).status, 'review')
  assert.equal(buildIntegritySummary([{ status: 'critical' }]).status, 'critical')
})

test('integrity checks surface canonical-account and staff permission gaps', () => {
  const checks = buildSecurityIntegrityChecks({
    accounts: [],
    staff: [{ id: 'staff-1', email: 'staff@example.com' }],
    counts: {},
    runtime: {
      isProduction: true,
      clientOrigins: allowedOrigins,
      cookieSecure: true,
      cookieSameSite: 'none',
      jwtSecretLength: 48,
    },
    canonicalDeveloperEmail: 'developer@example.com',
    canonicalOwnerEmail: 'owner@example.com',
  })

  assert.equal(checks.find((check) => check.id === 'canonical-developer').status, 'critical')
  assert.equal(checks.find((check) => check.id === 'staff-profile-coverage').status, 'critical')
  assert.equal(checks.find((check) => check.id === 'staff-permission-coverage').status, 'critical')
})
