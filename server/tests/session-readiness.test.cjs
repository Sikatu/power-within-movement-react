const test = require('node:test')
const assert = require('node:assert/strict')
const { buildSessionReadiness } = require('../src/services/sessionReadinessSignal')

test('confirmed session is ready when intake and care preparation are current', () => {
  const signal = buildSessionReadiness({
    bookingStatus: 'confirmed',
    clientLinked: true,
    requiredIntakeFields: 3,
    answeredRequiredFields: 3,
    onboardingStatus: 'completed',
    portalActive: true,
    assignedMemberCount: 1,
    careStatus: 'on_track',
    confirmationSent: true,
  })

  assert.equal(signal.band, 'ready')
  assert.equal(signal.score, 100)
  assert.equal(signal.intakeComplete, true)
})

test('requested session surfaces booking decision and missing intake', () => {
  const signal = buildSessionReadiness({
    bookingStatus: 'requested',
    requiredIntakeFields: 4,
    answeredRequiredFields: 1,
    confirmationSent: false,
  })

  assert.equal(signal.band, 'decision')
  assert.equal(signal.missingIntakeFields, 3)
  assert.match(signal.primaryReason, /booking decision/i)
})

test('confirmed session needs review when care work is overdue and inbox is waiting', () => {
  const signal = buildSessionReadiness({
    bookingStatus: 'confirmed',
    clientLinked: true,
    requiredIntakeFields: 2,
    answeredRequiredFields: 2,
    onboardingStatus: 'reviewed',
    portalActive: true,
    assignedMemberCount: 1,
    careStatus: 'attention',
    overdueTasks: 2,
    waitingOnTeam: 1,
    confirmationSent: true,
  })

  assert.equal(signal.band, 'review')
  assert.ok(signal.score < 70)
  assert.ok(signal.reasons.some((reason) => /overdue/i.test(reason)))
  assert.ok(signal.reasons.some((reason) => /waiting/i.test(reason)))
})
