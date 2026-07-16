const test = require('node:test')
const assert = require('node:assert/strict')

const { buildClientCoverage } = require('../src/services/clientCoverageSignal')

const now = new Date('2026-07-15T12:00:00.000Z').getTime()

function member(overrides = {}) {
  return {
    id: 'member-1',
    assignmentRole: 'primary',
    availabilityStatus: 'available',
    isAssignable: true,
    ...overrides,
  }
}

test('client coverage surfaces a missing Studio owner', () => {
  const signal = buildClientCoverage({ assignments: [], nextSessionAt: '2026-07-18T12:00:00.000Z', now })
  assert.equal(signal.band, 'unowned')
  assert.equal(signal.score, 100)
})

test('client coverage requires a handoff when assigned members are away and care is urgent', () => {
  const signal = buildClientCoverage({
    assignments: [member({ availabilityStatus: 'away' })],
    urgentTasks: 1,
    waitingOnTeam: 1,
    now,
  })
  assert.equal(signal.band, 'handoff')
  assert.equal(signal.availableOwnerCount, 0)
})

test('client coverage recognizes available backup when the primary owner is away', () => {
  const signal = buildClientCoverage({
    assignments: [
      member({ availabilityStatus: 'away' }),
      member({ id: 'member-2', assignmentRole: 'support', availabilityStatus: 'available' }),
    ],
    activeTasks: 2,
    now,
  })
  assert.equal(signal.band, 'backup')
  assert.equal(signal.availableOwnerCount, 1)
})

test('client coverage remains covered when ownership is available and care is current', () => {
  const signal = buildClientCoverage({
    assignments: [member()],
    activeTasks: 0,
    overdueTasks: 0,
    urgentTasks: 0,
    waitingOnTeam: 0,
    nextSessionAt: '2026-07-28T12:00:00.000Z',
    now,
  })
  assert.equal(signal.band, 'covered')
  assert.ok(signal.score < 30)
})
