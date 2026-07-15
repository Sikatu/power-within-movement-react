function buildBulkAssignmentPlan({ clientIds = [], existingAssignments = [] } = {}) {
  const latestByClient = new Map()

  for (const assignment of existingAssignments) {
    const clientProfileId = String(assignment?.client_profile_id || '')
    if (!clientProfileId || latestByClient.has(clientProfileId)) continue
    latestByClient.set(clientProfileId, assignment)
  }

  const uniqueClientIds = [...new Set(clientIds.map((value) => String(value || '')).filter(Boolean))]
  const alreadyAssigned = []
  const pending = []

  for (const clientProfileId of uniqueClientIds) {
    const existing = latestByClient.get(clientProfileId) || null
    if (existing?.status === 'active' && existing?.portal_resource_id) {
      alreadyAssigned.push({ clientProfileId, existing })
      continue
    }
    pending.push({ clientProfileId, existing })
  }

  return {
    eligibleCount: uniqueClientIds.length,
    alreadyAssigned,
    pending,
  }
}

module.exports = {
  buildBulkAssignmentPlan,
}
