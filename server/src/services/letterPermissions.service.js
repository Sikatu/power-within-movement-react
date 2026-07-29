const LETTER_ACTIONS = ['edit', 'test', 'schedule', 'send', 'cancel', 'retry', 'recovery']
const DELIVERY_CHANGE_CUTOFF_MINUTES = 5

function letterCapabilities(user, teamAccess = null) {
  const role = user?.role || ''
  if (role === 'developer') return Object.fromEntries(LETTER_ACTIONS.map((action) => [action, true]))
  if (role === 'owner' || role === 'admin') {
    return { edit: true, test: true, schedule: true, send: true, cancel: true, retry: true, recovery: false }
  }

  const managesCommunications = role === 'staff'
    && teamAccess?.permissions?.communications === 'manage'
  return {
    edit: managesCommunications,
    test: managesCommunications,
    schedule: false,
    send: false,
    cancel: false,
    retry: false,
    recovery: false,
  }
}

function requireLetterAction(action) {
  if (!LETTER_ACTIONS.includes(action)) throw new Error(`Unknown letter action: ${action}`)
  return (req, res, next) => {
    const capabilities = letterCapabilities(req.user, req.teamAccess)
    req.letterCapabilities = capabilities
    if (!capabilities[action]) {
      return res.status(403).json({
        ok: false,
        code: 'LETTER_ACTION_PERMISSION_REQUIRED',
        action,
        capabilities,
        error: `Your account cannot ${action} Letter broadcasts.`,
      })
    }
    return next()
  }
}

function assertDeliveryChangeOutsideCutoff(broadcast, now = new Date()) {
  if (broadcast?.status !== 'scheduled' || !broadcast?.scheduled_at) return
  const scheduledAt = new Date(broadcast.scheduled_at)
  const cutoffAt = new Date(scheduledAt.getTime() - DELIVERY_CHANGE_CUTOFF_MINUTES * 60 * 1000)
  if (now >= cutoffAt) {
    const error = new Error(`Scheduled broadcasts cannot be changed within ${DELIVERY_CHANGE_CUTOFF_MINUTES} minutes of delivery.`)
    error.code = 'LETTER_DELIVERY_CUTOFF_ACTIVE'
    error.statusCode = 409
    throw error
  }
}

module.exports = {
  DELIVERY_CHANGE_CUTOFF_MINUTES,
  LETTER_ACTIONS,
  assertDeliveryChangeOutsideCutoff,
  letterCapabilities,
  requireLetterAction,
}
