function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function dateTime(value) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function startOfLocalDay(value = Date.now()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function availabilityFactor(status) {
  return {
    available: 1,
    focused: 0.78,
    limited: 0.48,
    away: 0.12,
  }[status] || 0.7
}

function taskWeight(task, now = Date.now()) {
  const priority = {
    low: 0.75,
    normal: 1,
    high: 2,
    urgent: 3.5,
  }[task?.priority] || 1

  const dueAt = dateTime(task?.dueAt)
  const today = startOfLocalDay(now)
  const tomorrow = today + 86_400_000
  const timing = dueAt === null
    ? 0.35
    : dueAt < today
      ? 1.75
      : dueAt < tomorrow
        ? 0.85
        : 0

  return priority + timing
}

function sessionWeight(session, now = Date.now()) {
  const startsAt = dateTime(session?.startsAt)
  if (startsAt === null || startsAt < startOfLocalDay(now)) return 0

  const daysAway = (startsAt - startOfLocalDay(now)) / 86_400_000
  if (daysAway < 7) return 1.35
  if (daysAway < 14) return 0.8
  return 0.45
}

function calculateLoadSignal({
  capacityPercent = 100,
  availabilityStatus = 'available',
  taskPoints = 0,
  sessionPoints = 0,
  conversationPoints = 0,
  clientPoints = 0,
} = {}) {
  const configuredCapacity = Math.min(100, Math.max(10, safeNumber(capacityPercent, 100)))
  const effectiveUnits = Math.max(
    1,
    (configuredCapacity / 10) * availabilityFactor(availabilityStatus),
  )
  const rawPoints = Math.max(
    0,
    safeNumber(taskPoints)
      + safeNumber(sessionPoints)
      + safeNumber(conversationPoints)
      + safeNumber(clientPoints),
  )
  const loadPercent = Math.max(0, Math.round((rawPoints / effectiveUnits) * 100))
  const band = loadPercent < 70
    ? 'light'
    : loadPercent < 115
      ? 'balanced'
      : loadPercent < 155
        ? 'high'
        : 'overloaded'

  return {
    rawPoints: Number(rawPoints.toFixed(2)),
    effectiveUnits: Number(effectiveUnits.toFixed(2)),
    loadPercent,
    band,
  }
}

function isWithinDays(value, now, days) {
  const parsed = dateTime(value)
  if (parsed === null) return false
  const start = startOfLocalDay(now)
  return parsed >= start && parsed < start + (days * 86_400_000)
}

function buildMemberSnapshot(member, tasks, sessions, now = Date.now()) {
  const assignedTasks = tasks.filter((task) => task.ownerUserId === member.id)
  const memberSessions = sessions.filter((session) => session.memberIds.includes(member.id))
  const today = startOfLocalDay(now)
  const tomorrow = today + 86_400_000

  const taskPoints = assignedTasks.reduce((sum, task) => sum + taskWeight(task, now), 0)
  const sessionPoints = memberSessions.reduce((sum, session) => sum + sessionWeight(session, now), 0)
  const conversationPoints = safeNumber(member.openConversationCount) * 0.45
  const clientPoints = safeNumber(member.assignedClientCount) * 0.15
  const signal = calculateLoadSignal({
    capacityPercent: member.capacityPercent,
    availabilityStatus: member.availabilityStatus,
    taskPoints,
    sessionPoints,
    conversationPoints,
    clientPoints,
  })

  return {
    ...member,
    ...signal,
    metrics: {
      activeTasks: assignedTasks.length,
      overdueTasks: assignedTasks.filter((task) => {
        const dueAt = dateTime(task.dueAt)
        return dueAt !== null && dueAt < today
      }).length,
      dueToday: assignedTasks.filter((task) => {
        const dueAt = dateTime(task.dueAt)
        return dueAt !== null && dueAt >= today && dueAt < tomorrow
      }).length,
      urgentTasks: assignedTasks.filter((task) => task.priority === 'urgent').length,
      sessions7: memberSessions.filter((session) => isWithinDays(session.startsAt, now, 7)).length,
      sessions14: memberSessions.filter((session) => isWithinDays(session.startsAt, now, 14)).length,
      sessions30: memberSessions.filter((session) => isWithinDays(session.startsAt, now, 30)).length,
      openConversations: safeNumber(member.openConversationCount),
      assignedClients: safeNumber(member.assignedClientCount),
    },
  }
}

module.exports = {
  buildMemberSnapshot,
  calculateLoadSignal,
  dateTime,
  isWithinDays,
  safeNumber,
  startOfLocalDay,
  taskWeight,
}
