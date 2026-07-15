const MOMENTUM_BANDS = ['steady', 'watch', 'attention', 'paused', 'complete']

function asDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function daysSince(value, now = new Date()) {
  const date = asDate(value)
  if (!date) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000))
}

function isPast(value, now = new Date()) {
  const date = asDate(value)
  return Boolean(date && date.getTime() < now.getTime())
}

function isWithinDays(value, days, now = new Date()) {
  const date = asDate(value)
  if (!date) return false
  const difference = date.getTime() - now.getTime()
  return difference >= 0 && difference <= days * 86400000
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function buildClientMomentum(input = {}, now = new Date()) {
  const careStatus = input.careStatus || 'not_started'
  const overdueTasks = safeNumber(input.overdueTasks)
  const urgentTasks = safeNumber(input.urgentTasks)
  const waitingOnTeam = safeNumber(input.waitingOnTeam)
  const activeTasks = safeNumber(input.activeTasks)
  const lastTouchDays = daysSince(input.lastTouchAt, now)
  const reviewOverdue = isPast(input.nextReviewAt, now)
  const nextSessionSoon = isWithinDays(input.nextSessionAt, 14, now)
  const reasons = []

  if (careStatus === 'completed') {
    return {
      score: 100,
      band: 'complete',
      label: 'Journey complete',
      reasons: ['Care plan marked complete'],
      primaryReason: 'Care plan marked complete',
      reviewOverdue: false,
      lastTouchDays,
    }
  }

  if (careStatus === 'paused') {
    return {
      score: 55,
      band: 'paused',
      label: 'Paused',
      reasons: ['Care plan is paused'],
      primaryReason: 'Care plan is paused',
      reviewOverdue,
      lastTouchDays,
    }
  }

  let score = 100

  if (careStatus === 'attention') {
    score -= 24
    reasons.push('Care plan needs attention')
  } else if (careStatus === 'not_started') {
    score -= 10
    reasons.push('Care plan has not started')
  }

  if (overdueTasks > 0) {
    score -= Math.min(30, 12 + ((overdueTasks - 1) * 6))
    reasons.push(`${overdueTasks} overdue care ${overdueTasks === 1 ? 'action' : 'actions'}`)
  }

  if (urgentTasks > 0) {
    score -= Math.min(18, urgentTasks * 8)
    reasons.push(`${urgentTasks} urgent ${urgentTasks === 1 ? 'action' : 'actions'}`)
  }

  if (waitingOnTeam > 0) {
    score -= Math.min(20, waitingOnTeam * 10)
    reasons.push(`${waitingOnTeam} conversation${waitingOnTeam === 1 ? '' : 's'} waiting on the team`)
  }

  if (reviewOverdue) {
    score -= 15
    reasons.push('Care review is overdue')
  }

  if (lastTouchDays === null) {
    score -= 12
    reasons.push('No recent care touchpoint')
  } else if (lastTouchDays > 45) {
    score -= 20
    reasons.push(`No care touchpoint for ${lastTouchDays} days`)
  } else if (lastTouchDays > 21) {
    score -= 12
    reasons.push(`Last care touchpoint was ${lastTouchDays} days ago`)
  } else if (lastTouchDays > 10) {
    score -= 5
  }

  if (!input.nextSessionAt && (lastTouchDays === null || lastTouchDays > 30)) {
    score -= 8
    reasons.push('No upcoming session is scheduled')
  } else if (nextSessionSoon) {
    score += 4
  }

  if (activeTasks === 0 && input.journeyStage === 'active_work') {
    score -= 5
    reasons.push('No active care action is recorded')
  }

  score = clamp(Math.round(score), 0, 100)
  const band = score < 50 ? 'attention' : score < 72 ? 'watch' : 'steady'
  const label = band === 'attention'
    ? 'Needs attention'
    : band === 'watch'
      ? 'Watch closely'
      : 'Steady momentum'
  const normalizedReasons = unique(reasons)

  return {
    score,
    band,
    label,
    reasons: normalizedReasons,
    primaryReason: normalizedReasons[0] || 'No immediate operational concern',
    reviewOverdue,
    lastTouchDays,
  }
}

module.exports = {
  MOMENTUM_BANDS,
  buildClientMomentum,
  daysSince,
  isPast,
  isWithinDays,
  safeNumber,
}
