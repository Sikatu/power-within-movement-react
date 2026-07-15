function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function buildSessionReadiness(input = {}) {
  const bookingStatus = normalizeStatus(input.bookingStatus || 'requested')
  const clientLinked = Boolean(input.clientLinked)
  const requiredIntakeFields = Math.max(0, safeNumber(input.requiredIntakeFields))
  const answeredRequiredFields = Math.max(0, safeNumber(input.answeredRequiredFields))
  const missingIntakeFields = Math.max(0, requiredIntakeFields - answeredRequiredFields)
  const onboardingStatus = normalizeStatus(input.onboardingStatus || '')
  const onboardingRequired = Boolean(input.onboardingRequired)
  const careStatus = normalizeStatus(input.careStatus || '')
  const activeTasks = Math.max(0, safeNumber(input.activeTasks))
  const overdueTasks = Math.max(0, safeNumber(input.overdueTasks))
  const urgentTasks = Math.max(0, safeNumber(input.urgentTasks))
  const waitingOnTeam = Math.max(0, safeNumber(input.waitingOnTeam))
  const assignedMemberCount = Math.max(0, safeNumber(input.assignedMemberCount))
  const confirmationSent = Boolean(input.confirmationSent)
  const portalActive = Boolean(input.portalActive)

  const reasons = []
  let score = 100

  if (bookingStatus === 'requested') {
    score -= 42
    reasons.push('Session request still needs a booking decision')
  } else if (bookingStatus === 'approved') {
    score -= 14
    reasons.push('Session is approved but not yet confirmed')
  }

  if (missingIntakeFields > 0) {
    score -= Math.min(28, 10 + missingIntakeFields * 6)
    reasons.push(`${missingIntakeFields} required intake response${missingIntakeFields === 1 ? '' : 's'} missing`)
  }

  if (clientLinked) {
    if (onboardingRequired && !['submitted', 'reviewed', 'completed'].includes(onboardingStatus)) {
      score -= onboardingStatus === 'in_progress' ? 8 : 14
      reasons.push(onboardingStatus === 'in_progress'
        ? 'Client onboarding is still in progress'
        : 'Client onboarding is not ready for review')
    }

    if (!portalActive) {
      score -= 6
      reasons.push('Client portal has not been activated')
    }

    if (assignedMemberCount === 0) {
      score -= 12
      reasons.push('No Studio team member is assigned')
    }

    if (careStatus === 'attention') {
      score -= 10
      reasons.push('Client care plan currently needs attention')
    } else if (careStatus === 'paused') {
      score -= 14
      reasons.push('Client care plan is paused')
    }
  }

  if (overdueTasks > 0) {
    score -= Math.min(24, 12 + overdueTasks * 4)
    reasons.push(`${overdueTasks} overdue care action${overdueTasks === 1 ? '' : 's'}`)
  } else if (urgentTasks > 0) {
    score -= Math.min(16, 8 + urgentTasks * 3)
    reasons.push(`${urgentTasks} urgent care action${urgentTasks === 1 ? '' : 's'}`)
  } else if (activeTasks > 3) {
    score -= 5
    reasons.push(`${activeTasks} active care actions to review`)
  }

  if (waitingOnTeam > 0) {
    score -= Math.min(16, 8 + waitingOnTeam * 3)
    reasons.push(`${waitingOnTeam} conversation${waitingOnTeam === 1 ? '' : 's'} waiting on the Studio`)
  }

  if (['approved', 'confirmed'].includes(bookingStatus) && !confirmationSent) {
    score -= 8
    reasons.push('Booking confirmation has not been recorded as sent')
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let band = 'ready'
  if (bookingStatus === 'requested') band = 'decision'
  else if (score < 60 || overdueTasks > 0 || waitingOnTeam > 0) band = 'review'
  else if (score < 86 || missingIntakeFields > 0 || bookingStatus === 'approved') band = 'almost'

  const labels = {
    decision: 'Decision needed',
    review: 'Needs review',
    almost: 'Almost ready',
    ready: 'Ready',
  }

  return {
    score,
    band,
    label: labels[band],
    reasons,
    primaryReason: reasons[0] || 'Session preparation is current',
    missingIntakeFields,
    intakeComplete: missingIntakeFields === 0,
  }
}

module.exports = {
  buildSessionReadiness,
  safeNumber,
}
