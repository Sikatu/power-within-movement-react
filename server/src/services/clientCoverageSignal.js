function dateTime(value) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function daysUntil(value, now = Date.now()) {
  const target = dateTime(value)
  if (target === null) return null
  return Math.ceil((target - now) / 86400000)
}

function availabilityRank(status) {
  const ranks = {
    available: 4,
    focused: 3,
    limited: 2,
    away: 1,
  }
  return ranks[status] || 0
}

function buildClientCoverage({
  assignments = [],
  activeTasks = 0,
  overdueTasks = 0,
  urgentTasks = 0,
  waitingOnTeam = 0,
  nextSessionAt = null,
  now = Date.now(),
} = {}) {
  const normalizedAssignments = Array.isArray(assignments) ? assignments : []
  const availableAssignments = normalizedAssignments.filter((member) => (
    member.isAssignable !== false
    && ['available', 'focused'].includes(member.availabilityStatus)
  ))
  const primary = normalizedAssignments.find((member) => member.assignmentRole === 'primary') || null
  const primaryAvailable = primary
    ? primary.isAssignable !== false && ['available', 'focused'].includes(primary.availabilityStatus)
    : false
  const sessionDays = daysUntil(nextSessionAt, now)
  const sessionSoon = sessionDays !== null && sessionDays >= 0 && sessionDays <= 7
  const pressure = Number(overdueTasks || 0) * 18
    + Number(urgentTasks || 0) * 20
    + Number(waitingOnTeam || 0) * 12
    + (sessionSoon ? 16 : 0)

  if (!normalizedAssignments.length) {
    return {
      band: 'unowned',
      score: 100,
      primaryReason: 'No Studio owner is assigned to this client.',
      reasons: [
        'Assign a primary or support team member before the next client touchpoint.',
        ...(sessionSoon ? ['An upcoming session increases the urgency of establishing ownership.'] : []),
      ],
      availableOwnerCount: 0,
      sessionDays,
    }
  }

  if (!availableAssignments.length && (overdueTasks || urgentTasks || waitingOnTeam || sessionSoon)) {
    return {
      band: 'handoff',
      score: Math.min(100, 72 + pressure),
      primaryReason: 'The assigned team is unavailable while active care needs coverage.',
      reasons: [
        ...(overdueTasks ? [`${overdueTasks} overdue care item${overdueTasks === 1 ? '' : 's'} need ownership.`] : []),
        ...(urgentTasks ? [`${urgentTasks} urgent care item${urgentTasks === 1 ? '' : 's'} need coverage.`] : []),
        ...(waitingOnTeam ? [`${waitingOnTeam} conversation${waitingOnTeam === 1 ? '' : 's'} are waiting on the Studio.`] : []),
        ...(sessionSoon ? ['A session is approaching within seven days.'] : []),
      ],
      availableOwnerCount: 0,
      sessionDays,
    }
  }

  if (!availableAssignments.length) {
    return {
      band: 'coverage',
      score: 70,
      primaryReason: 'Assigned care is currently limited or away.',
      reasons: ['Prepare backup ownership before new client work becomes urgent.'],
      availableOwnerCount: 0,
      sessionDays,
    }
  }

  if (primary && !primaryAvailable && availableAssignments.length) {
    return {
      band: 'backup',
      score: Math.min(84, 42 + pressure),
      primaryReason: 'The primary owner is unavailable, but backup coverage exists.',
      reasons: [
        `${availableAssignments.length} available team member${availableAssignments.length === 1 ? '' : 's'} can provide continuity.`,
        ...(activeTasks ? [`${activeTasks} active care item${activeTasks === 1 ? '' : 's'} should be reviewed for handoff.`] : []),
      ],
      availableOwnerCount: availableAssignments.length,
      sessionDays,
    }
  }

  if (overdueTasks || urgentTasks || waitingOnTeam) {
    return {
      band: 'watch',
      score: Math.min(82, 36 + pressure),
      primaryReason: 'Coverage is available, but active care pressure needs coordination.',
      reasons: [
        ...(overdueTasks ? [`${overdueTasks} overdue care item${overdueTasks === 1 ? '' : 's'} remain open.`] : []),
        ...(urgentTasks ? [`${urgentTasks} urgent care item${urgentTasks === 1 ? '' : 's'} remain open.`] : []),
        ...(waitingOnTeam ? [`${waitingOnTeam} conversation${waitingOnTeam === 1 ? '' : 's'} are waiting on the Studio.`] : []),
      ],
      availableOwnerCount: availableAssignments.length,
      sessionDays,
    }
  }

  const strongestAvailability = normalizedAssignments.reduce(
    (best, member) => Math.max(best, availabilityRank(member.availabilityStatus)),
    0,
  )

  return {
    band: 'covered',
    score: Math.max(8, 28 - strongestAvailability * 4 - availableAssignments.length * 2),
    primaryReason: 'Client ownership and backup coverage are in place.',
    reasons: sessionSoon
      ? ['An upcoming session is covered by an available assigned team member.']
      : ['No immediate ownership gap is visible.'],
    availableOwnerCount: availableAssignments.length,
    sessionDays,
  }
}

module.exports = {
  availabilityRank,
  buildClientCoverage,
  dateTime,
  daysUntil,
}
