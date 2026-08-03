import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const contact = read('src/pages/Contact.jsx')
const publicRoutes = read('server/src/routes/public.routes.js')
const leads = read('src/pages/admin/AdminLeadPipeline.jsx')
const client360 = read('src/pages/admin/AdminClient360.jsx')
const scheduler = read('src/pages/admin/AdminScheduler.jsx')
const followThrough = read('src/pages/admin/AdminSessionFollowThrough.jsx')
const portalDashboard = read('src/pages/ClientPortalDashboard.jsx')
const notifications = read('src/components/NotificationCenter.jsx')
const acceptanceRecord = read('docs/workflow-acceptance.md')
const failures = []

const phaseAudits = [
  [3, 'client-management'],
  [4, 'session-handoff'],
  [5, 'session-follow-through'],
  [6, 'session-communication'],
  [7, 'resource-delivery'],
  [8, 'next-session-continuity'],
  [9, 'session-readiness-context'],
  [10, 'client-care-context'],
  [11, 'daily-planning-handoffs'],
  [12, 'capacity-ownership'],
  [13, 'automation-continuity'],
  [14, 'program-access-continuity'],
  [15, 'communication-continuity'],
  [16, 'client-portal-continuity'],
  [17, 'notification-recovery'],
]

for (const [phase, slug] of phaseAudits) {
  const path = `scripts/check-workflow-phase${phase}-${slug}.mjs`
  if (!existsSync(path)) failures.push(`Phase ${phase} audit is missing: ${path}`)
  if (!runner.includes(`'${path}'`)) failures.push(`Phase ${phase} audit is not registered in the full runner`)
  if (!packageSource.includes(`"workflow:qa:phase${phase}"`)) failures.push(`Phase ${phase} package command is missing`)
}

const journeyRequirements = [
  [contact, 'submitPublicContactInquiry({', 'public inquiry submission'],
  [publicRoutes, 'saveContactInquiryAsClientLead(inquiry)', 'inquiry-to-lead persistence'],
  [publicRoutes, "triggerType: 'new_lead'", 'new-lead automation enrollment'],
  [leads, 'Convert and save', 'intentional lead conversion'],
  [leads, '/admin/client-360/${selectedLead.id}', 'lead-to-client care handoff'],
  [client360, '/admin/scheduler?booking=', 'care-to-session handoff'],
  [scheduler, '/admin/follow-through?session=', 'session-to-follow-through handoff'],
  [followThrough, '/admin/inbox?', 'follow-through communication handoff'],
  [followThrough, '/admin/assets?', 'follow-through resource handoff'],
  [client360, '/admin/courses?client=', 'client learning-access handoff'],
  [client360, '/admin/memberships?client=', 'client membership handoff'],
  [portalDashboard, '/client-portal/resources?resource=', 'exact portal resource restoration'],
  [portalDashboard, '/client-portal/sessions?booking=', 'exact portal session restoration'],
  [notifications, 'if (notification.actionUrl && !actionPath)', 'notification destination recovery'],
  [acceptanceRecord, 'Inquiry → Lead → Client → Session → Follow-through → Ongoing care', 'documented accepted journey'],
]

for (const [source, token, label] of journeyRequirements) {
  if (!source.includes(token)) failures.push(`End-to-end workflow is missing ${label}: ${token}`)
}

if (!runner.includes("'scripts/check-workflow-phase18-end-to-end-acceptance.mjs'")) {
  failures.push('Phase 18 is not registered in the full audit runner')
}

if (!packageSource.includes('"workflow:qa:phase18"')) {
  failures.push('Phase 18 package command is missing')
}

if (failures.length) {
  console.error('\nPhase 18 end-to-end workflow acceptance failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 18 end-to-end workflow acceptance passed (15 registered optimization audits and a verified inquiry-to-ongoing-care journey with exact, recoverable handoffs).')
