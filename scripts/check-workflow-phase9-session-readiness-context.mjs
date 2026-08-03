import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const readiness = read('src/pages/admin/AdminSessionReadiness.jsx')
const onboarding = read('src/pages/admin/AdminOnboardingStudio.jsx')
const attention = read('src/pages/admin/AdminAttentionQueue.jsx')
const inbox = read('src/pages/admin/AdminInbox.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [readiness, "searchParams.get('session') || ''", 'requested session selection'],
  [readiness, 'booking: selectedSession.id', 'exact booking handoff'],
  [readiness, '`/admin/onboarding?${clientParams(selectedSession)}`', 'client-aware onboarding handoff'],
  [readiness, '`/admin/attention?${clientParams(selectedSession)}`', 'client-aware attention handoff'],
  [readiness, '`/admin/inbox?${clientParams(selectedSession)}`', 'client-aware Inbox handoff'],
  [onboarding, "searchParams.get('client') || ''", 'requested onboarding client'],
  [onboarding, 'record.clientProfileId === requestedClientId', 'existing onboarding selection'],
  [onboarding, 'clientId: requestedClientId', 'new onboarding preselection'],
  [attention, 'task.clientProfileId === requestedClientId', 'exact attention item selection'],
  [attention, 'useState(requestedClientName)', 'visible client attention filter'],
  [inbox, 'item.client_profile_id === requestedClientId', 'existing client conversation selection'],
  [runner, "'scripts/check-workflow-phase9-session-readiness-context.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase9"', 'Phase 9 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 9 session readiness context audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 9 session readiness context audit passed (exact session restoration, booking-aware Sessions handoff, client-aware onboarding and attention selection, and existing secure conversation continuity).')
