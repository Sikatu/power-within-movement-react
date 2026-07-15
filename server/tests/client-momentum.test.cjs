const test = require('node:test')
const assert = require('node:assert/strict')

const { buildClientMomentum } = require('../src/services/clientMomentumSignal')

const now = new Date('2026-07-15T12:00:00.000Z')

test('client momentum stays steady when care is current and a session is upcoming', () => {
  const signal = buildClientMomentum({
    careStatus: 'on_track',
    lastTouchAt: '2026-07-11T12:00:00.000Z',
    nextSessionAt: '2026-07-20T12:00:00.000Z',
    activeTasks: 2,
    overdueTasks: 0,
    urgentTasks: 0,
    waitingOnTeam: 0,
    nextReviewAt: '2026-08-01T12:00:00.000Z',
  }, now)

  assert.equal(signal.band, 'steady')
  assert.ok(signal.score >= 72)
  assert.equal(signal.reviewOverdue, false)
})

test('client momentum surfaces overdue care and waiting conversations', () => {
  const signal = buildClientMomentum({
    careStatus: 'attention',
    lastTouchAt: '2026-05-01T12:00:00.000Z',
    nextSessionAt: null,
    activeTasks: 4,
    overdueTasks: 2,
    urgentTasks: 1,
    waitingOnTeam: 2,
    nextReviewAt: '2026-07-01T12:00:00.000Z',
  }, now)

  assert.equal(signal.band, 'attention')
  assert.ok(signal.score < 50)
  assert.equal(signal.reviewOverdue, true)
  assert.ok(signal.reasons.some((reason) => reason.includes('waiting on the team')))
})
