function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function validDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildSessionFollowThrough(input = {}, now = new Date()) {
  const bookingStatus = normalizeStatus(input.bookingStatus || 'completed')
  const sessionRecorded = Boolean(input.sessionRecordId)
  const clientLinked = Boolean(input.clientLinked)
  const activeTasks = Math.max(0, safeNumber(input.activeTasks))
  const overdueTasks = Math.max(0, safeNumber(input.overdueTasks))
  const urgentTasks = Math.max(0, safeNumber(input.urgentTasks))
  const waitingOnTeam = Math.max(0, safeNumber(input.waitingOnTeam))
  const resourcesShared = Math.max(0, safeNumber(input.resourcesShared))
  const assignedMemberCount = Math.max(0, safeNumber(input.assignedMemberCount))
  const followUpAt = validDate(input.followUpAt)
  const nextSessionAt = validDate(input.nextSessionAt)
  const currentTime = validDate(now) || new Date()
  const followUpOverdue = Boolean(followUpAt && followUpAt.getTime() < currentTime.getTime())
  const statusNeedsReconciliation = ['requested', 'approved', 'confirmed'].includes(bookingStatus)
  const recoveryNeeded = bookingStatus === 'no_show'
  const nextStepScheduled = activeTasks > 0 || Boolean(followUpAt) || Boolean(nextSessionAt)

  const reasons = []
  let score = 100

  if (statusNeedsReconciliation) {
    reasons.push('The appointment time has passed, but the session status is still open.')
    score -= 45
  }

  if (recoveryNeeded) {
    reasons.push('The client missed the session and may need a thoughtful recovery touchpoint.')
    score -= 35
  }

  if (!clientLinked) {
    reasons.push('The session is not connected to a Client 360 profile.')
    score -= 20
  }

  if (!sessionRecorded && bookingStatus === 'completed') {
    reasons.push('A completed-session record has not been documented yet.')
    score -= 30
  }

  if (followUpOverdue) {
    reasons.push('The recorded follow-up date has passed.')
    score -= 30
  }

  if (overdueTasks > 0) {
    reasons.push(`${overdueTasks} follow-through ${overdueTasks === 1 ? 'action is' : 'actions are'} overdue.`)
    score -= Math.min(35, overdueTasks * 14)
  }

  if (urgentTasks > 0) {
    reasons.push(`${urgentTasks} urgent care ${urgentTasks === 1 ? 'action needs' : 'actions need'} attention.`)
    score -= Math.min(25, urgentTasks * 12)
  }

  if (waitingOnTeam > 0) {
    reasons.push(`${waitingOnTeam} client ${waitingOnTeam === 1 ? 'conversation is' : 'conversations are'} waiting on the Studio team.`)
    score -= Math.min(25, waitingOnTeam * 10)
  }

  if (!nextStepScheduled && bookingStatus === 'completed') {
    reasons.push('No follow-up action, follow-up date, or next session is recorded.')
    score -= 20
  }

  if (assignedMemberCount === 0 && clientLinked) {
    reasons.push('No Studio team member is assigned to this client.')
    score -= 10
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)))

  let band = 'complete'
  let label = 'Continuity set'
  let primaryReason = 'Notes and the next care step are in place'

  if (statusNeedsReconciliation) {
    band = 'reconcile'
    label = 'Status needs update'
    primaryReason = 'Close or reschedule the past appointment before follow-through can be trusted'
  } else if (recoveryNeeded) {
    band = 'recovery'
    label = 'Recovery needed'
    primaryReason = 'Reconnect after the missed session and decide the next care step'
  } else if (followUpOverdue || overdueTasks > 0 || urgentTasks > 0 || waitingOnTeam > 0) {
    band = 'overdue'
    label = 'Follow-up overdue'
    primaryReason = 'An accountable client-care action is already waiting'
  } else if (!sessionRecorded && bookingStatus === 'completed') {
    band = 'notes'
    label = 'Notes needed'
    primaryReason = 'Document the completed session before context is lost'
  } else if (!nextStepScheduled && bookingStatus === 'completed') {
    band = 'next'
    label = 'Next step needed'
    primaryReason = 'Set a follow-up action, follow-up date, or next session'
  }

  return {
    band,
    label,
    score: normalizedScore,
    primaryReason,
    reasons,
    statusNeedsReconciliation,
    recoveryNeeded,
    sessionRecorded,
    followUpOverdue,
    nextStepScheduled,
    resourcesShared,
  }
}

module.exports = {
  buildSessionFollowThrough,
  safeNumber,
}
