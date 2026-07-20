const test = require('node:test')
const assert = require('node:assert/strict')

const {
  PHASE30_REQUIRED_TABLES,
  RELEASE_CANDIDATE_PHASE,
  RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS,
  RELEASE_CANDIDATE_REQUIRED_INDEXES,
  buildReleaseReadinessSnapshot,
  summarizeChecks,
} = require('../src/services/releaseReadiness.service')
const { validateRehearsalTarget } = require('../scripts/run-phase30-migration-rehearsal.cjs')

function productionConfig(overrides = {}) {
  return {
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret',
    resendApiKey: 'secret-provider-key',
    newsletterEmailFrom: 'letters@example.com',
    portalEmailFrom: 'portal@example.com',
    publicSiteUrl: 'https://example.com',
    publicApiUrl: 'https://api.example.com',
    clientOrigins: ['https://example.com'],
    cookieSecure: true,
    cookieSameSite: 'lax',
    ...overrides,
  }
}

const storage = {
  driver: 's3',
  configured: true,
  privateDelivery: 'authenticated_proxy',
  accessGrants: 'short_lived_scoped',
  malwareScanner: 'disabled',
}
const transcription = {
  provider: 'generic',
  configured: true,
  status: 'ready',
  message: 'Server transcription is ready.',
}

test('Phase 50 readiness becomes ready only with the complete release-candidate foundation', () => {
  const snapshot = buildReleaseReadinessSnapshot({
    config: productionConfig(),
    storage,
    transcription,
    foundTables: PHASE30_REQUIRED_TABLES,
    foundConstraints: RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS,
    foundIndexes: RELEASE_CANDIDATE_REQUIRED_INDEXES,
    databaseLatencyMs: 25,
    databaseTime: new Date().toISOString(),
    founderTimezone: 'America/Chicago',
    studioProfileCount: 1,
  })

  assert.equal(snapshot.phase, RELEASE_CANDIDATE_PHASE)
  assert.equal(snapshot.summary.status, 'ready')
  assert.equal(snapshot.summary.automatedReady, true)
  assert.equal(snapshot.database.missingTables.length, 0)
  assert.equal(snapshot.externalEvidenceRequired, true)
})

test('Phase 50 readiness blocks missing schema and delivery providers without exposing secrets', () => {
  const snapshot = buildReleaseReadinessSnapshot({
    config: productionConfig({ resendApiKey: '' }),
    storage: { ...storage, configured: false },
    transcription: { ...transcription, configured: false, status: 'disabled', message: 'Disabled.' },
    foundTables: ['system_users'],
    databaseLatencyMs: 40,
  })

  assert.equal(snapshot.summary.status, 'blocked')
  assert.ok(snapshot.summary.blocked >= 3)
  assert.ok(snapshot.database.missingTables.includes('founder_recordings'))
  assert.ok(snapshot.database.missingTables.includes('studio_profiles'))
  assert.ok(snapshot.database.missingTables.includes('notifications'))
  assert.doesNotMatch(JSON.stringify(snapshot), /secret-provider-key|a-production-secret/)
})

test('Phase 50 readiness blocks missing persistence invariants and the primary Studio Profile', () => {
  const snapshot = buildReleaseReadinessSnapshot({
    config: productionConfig(),
    storage,
    transcription,
    foundTables: PHASE30_REQUIRED_TABLES,
    foundConstraints: [],
    foundIndexes: [],
    databaseLatencyMs: 25,
    founderTimezone: 'America/Chicago',
    studioProfileCount: 0,
  })

  assert.equal(snapshot.summary.status, 'blocked')
  assert.deepEqual(snapshot.database.missingConstraints, RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS)
  assert.deepEqual(snapshot.database.missingIndexes, RELEASE_CANDIDATE_REQUIRED_INDEXES)
  assert.equal(snapshot.database.studioProfileCount, 0)
})

test('Phase 50 readiness summary treats review as not automated-ready', () => {
  const summary = summarizeChecks([
    { status: 'pass' },
    { status: 'review' },
  ])
  assert.equal(summary.status, 'review')
  assert.equal(summary.automatedReady, false)
})

test('migration rehearsal refuses the same production database target', () => {
  const url = 'postgresql://user:password@db.example.com:5432/power_within'
  const result = validateRehearsalTarget({
    rehearsalUrl: url,
    productionUrl: url,
    confirmation: 'RUN ISOLATED REHEARSAL power_within',
  })
  assert.equal(result.ok, false)
  assert.match(result.failures.join(' '), /production rehearsal is forbidden/)
})

test('migration rehearsal requires an exact isolated-target confirmation', () => {
  const result = validateRehearsalTarget({
    rehearsalUrl: 'postgresql://user:password@staging.example.com:5432/power_within_phase30',
    productionUrl: 'postgresql://user:password@db.example.com:5432/power_within',
    confirmation: 'RUN ISOLATED REHEARSAL power_within_phase30',
  })
  assert.equal(result.ok, true)
  assert.equal(result.rehearsal.database, 'power_within_phase30')
})
