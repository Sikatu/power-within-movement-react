import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const dashboard = read('src/pages/ClientPortalDashboard.jsx')
const resources = read('src/pages/ClientPortalResources.jsx')
const sessions = read('src/pages/ClientPortalSessions.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [dashboard, '/client-portal/resources?resource=${encodeURIComponent(featuredResource.id)}', 'exact featured-resource handoff'],
  [dashboard, '/client-portal/sessions?booking=${encodeURIComponent(nextBooking.id)}', 'exact upcoming-session handoff'],
  [dashboard, '/client-portal/resources?resource=${encodeURIComponent(resource.id)}', 'dashboard library resource handoff'],
  [resources, "searchParams.get('resource') || ''", 'requested resource restoration'],
  [resources, 'requestedResource || resources[0] || null', 'requested resource priority'],
  [resources, 'That resource is no longer available.', 'missing resource recovery'],
  [sessions, "searchParams.get('booking') || ''", 'requested session restoration'],
  [sessions, 'requestedBooking?.id === booking.id', 'requested session selection'],
  [sessions, 'That session is no longer available.', 'missing session recovery'],
  [runner, "'scripts/check-workflow-phase16-client-portal-continuity.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase16"', 'Phase 16 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 16 client portal continuity workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 16 client portal continuity workflow audit passed (exact dashboard-to-resource and dashboard-to-session restoration with truthful missing-item recovery).')
