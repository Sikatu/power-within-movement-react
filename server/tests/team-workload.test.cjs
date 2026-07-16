const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildMemberSnapshot,
  calculateLoadSignal,
} = require('../src/services/teamWorkloadSignal')

test('team workload signal respects configured capacity and availability', () => {
  const light = calculateLoadSignal({
    capacityPercent: 100,
    availabilityStatus: 'available',
    taskPoints: 3,
  })
  const overloaded = calculateLoadSignal({
    capacityPercent: 40,
    availabilityStatus: 'limited',
    taskPoints: 8,
  })

  assert.equal(light.band, 'light')
  assert.equal(overloaded.band, 'overloaded')
  assert.ok(overloaded.loadPercent > light.loadPercent)
})

test('member workload counts active tasks and upcoming sessions', () => {
  const now = new Date(2026, 6, 15, 10, 0, 0).getTime()
  const member = {
    id: 'team-1',
    capacityPercent: 100,
    availabilityStatus: 'available',
    assignedClientCount: 3,
    openConversationCount: 2,
  }
  const tasks = [
    {
      id: 'task-1',
      ownerUserId: 'team-1',
      priority: 'urgent',
      dueAt: new Date(2026, 6, 14, 12).toISOString(),
    },
    {
      id: 'task-2',
      ownerUserId: 'someone-else',
      priority: 'normal',
      dueAt: null,
    },
  ]
  const sessions = [
    {
      id: 'session-1',
      memberIds: ['team-1'],
      startsAt: new Date(2026, 6, 17, 12).toISOString(),
    },
  ]

  const snapshot = buildMemberSnapshot(member, tasks, sessions, now)

  assert.equal(snapshot.metrics.activeTasks, 1)
  assert.equal(snapshot.metrics.overdueTasks, 1)
  assert.equal(snapshot.metrics.urgentTasks, 1)
  assert.equal(snapshot.metrics.sessions7, 1)
  assert.ok(snapshot.loadPercent > 0)
})
