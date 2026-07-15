const test = require('node:test')
const assert = require('node:assert/strict')
const { buildSessionFollowThrough } = require('../src/services/sessionFollowThroughSignal')

const now = new Date('2026-07-15T12:00:00.000Z')

test('completed session has continuity when notes and a next step are recorded', () => {
  const signal = buildSessionFollowThrough({
    bookingStatus: 'completed',
    clientLinked: true,
    sessionRecordId: 'record-1',
    activeTasks: 1,
    assignedMemberCount: 1,
    nextSessionAt: '2026-08-01T12:00:00.000Z',
  }, now)

  assert.equal(signal.band, 'complete')
  assert.equal(signal.sessionRecorded, true)
  assert.equal(signal.nextStepScheduled, true)
})

test('completed session surfaces missing notes before continuity is considered complete', () => {
  const signal = buildSessionFollowThrough({
    bookingStatus: 'completed',
    clientLinked: true,
    activeTasks: 1,
    assignedMemberCount: 1,
  }, now)

  assert.equal(signal.band, 'notes')
  assert.match(signal.primaryReason, /document/i)
})

test('past open session requires status reconciliation', () => {
  const signal = buildSessionFollowThrough({
    bookingStatus: 'confirmed',
    clientLinked: true,
    sessionRecordId: 'record-1',
  }, now)

  assert.equal(signal.band, 'reconcile')
  assert.equal(signal.statusNeedsReconciliation, true)
})

test('overdue care and a waiting conversation outrank a missing future appointment', () => {
  const signal = buildSessionFollowThrough({
    bookingStatus: 'completed',
    clientLinked: true,
    sessionRecordId: 'record-1',
    overdueTasks: 2,
    waitingOnTeam: 1,
    assignedMemberCount: 1,
  }, now)

  assert.equal(signal.band, 'overdue')
  assert.ok(signal.reasons.some((reason) => /overdue/i.test(reason)))
  assert.ok(signal.reasons.some((reason) => /waiting/i.test(reason)))
})
