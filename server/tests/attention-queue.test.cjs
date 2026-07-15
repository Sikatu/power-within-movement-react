const test = require('node:test')
const assert = require('node:assert/strict')

const { dueBucket } = require('../src/services/attentionQueueTiming')

const now = new Date(2026, 6, 15, 15, 0, 0).getTime()

function localDue(day, hour = 12) {
  return new Date(2026, 6, day, hour, 0, 0).toISOString()
}

function task(dueAt) {
  return { dueAt }
}

test('attention queue classifies missing and invalid dates as unscheduled', () => {
  assert.equal(dueBucket(task(null), now), 'unscheduled')
  assert.equal(dueBucket(task('not-a-date'), now), 'unscheduled')
})

test('attention queue classifies overdue, today, this week, and later dates', () => {
  assert.equal(dueBucket(task(localDue(14)), now), 'overdue')
  assert.equal(dueBucket(task(localDue(15, 18)), now), 'today')
  assert.equal(dueBucket(task(localDue(18)), now), 'this_week')
  assert.equal(dueBucket(task(new Date(2026, 7, 1, 12).toISOString()), now), 'later')
})
