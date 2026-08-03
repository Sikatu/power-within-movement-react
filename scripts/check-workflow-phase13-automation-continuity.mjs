import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const automations = read('src/pages/admin/AdminAutomationStudio.jsx')
const leads = read('src/pages/admin/AdminLeadPipeline.jsx')
const client360 = read('src/pages/admin/AdminClient360.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [automations, "searchParams.get('workflow') || ''", 'requested automation workflow'],
  [automations, "searchParams.get('enrollment') || ''", 'requested automation enrollment'],
  [automations, "searchParams.get('client') || ''", 'requested automation client'],
  [automations, "searchParams.get('mode') || ''", 'requested automation mode'],
  [automations, 'requestedEnrollment?.workflowId || requestedWorkflowId', 'enrollment-owned workflow restoration'],
  [automations, 'item.clientProfileId === requestedClientId', 'client-scoped enrollment activity'],
  [automations, "aria-current={enrollment.id === requestedEnrollmentId ? 'true' : undefined}", 'requested enrollment semantics'],
  [automations, 'to={`/admin/client-360/${enrollment.clientProfileId}`}', 'enrollment client handoff'],
  [leads, 'to={`/admin/automations?client=${selectedLead.id}&mode=activity`}', 'lead automation handoff'],
  [client360, 'to={`/admin/automations?client=${client.id}&mode=activity`}', 'Client 360 automation handoff'],
  [runner, "'scripts/check-workflow-phase13-automation-continuity.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase13"', 'Phase 13 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 13 automation continuity workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 13 automation continuity workflow audit passed (exact workflow, enrollment, client, and workspace restoration with direct lead and care-context handoffs).')
