import { readFileSync } from 'node:fs'

const leadsSource = readFileSync('src/pages/admin/AdminLeadPipeline.jsx', 'utf8')
const onboardingSource = readFileSync('src/pages/admin/AdminOnboardingStudio.jsx', 'utf8')
const automationsSource = readFileSync('src/pages/admin/AdminAutomationStudio.jsx', 'utf8')
const automationRouteSource = readFileSync('server/src/routes/admin.automationStudio.routes.js', 'utf8')
const serverAppSource = readFileSync('server/src/app.js', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const leadTokens = [
  "const [pipelineStageView, setPipelineStageView] = useState('new_inquiry')",
  "const [leadWorkspaceView, setLeadWorkspaceView] = useState('profile')",
  'aria-label="Lead pipeline stages"',
  'aria-label="Selected lead workspace"',
  "leadWorkspaceView === 'profile'",
  "leadWorkspaceView === 'followups'",
  "leadWorkspaceView === 'activity'",
  'Follow-ups ({detail.followUps?.length || 0})',
  'Notes & activity ({detail.activities?.length || 0})',
]

for (const token of leadTokens) {
  if (!leadsSource.includes(token)) failures.push(`Leads is missing: ${token}`)
}

const onboardingTokens = [
  "const [activeTab, setActiveTab] = useState('clients')",
  '>Clients</button>',
  '>Booking Rules</button>',
  '>Forms</button>',
  '>Send Due Messages</button>',
  "activeTab === 'templates'",
  "activeTab === 'appointments'",
  "activeTab === 'clients'",
]

for (const token of onboardingTokens) {
  if (!onboardingSource.includes(token)) failures.push(`Onboarding is missing: ${token}`)
}

const automationTokens = [
  "const [workspaceView, setWorkspaceView] = useState('activity')",
  'aria-label="Automation workspace"',
  "workspaceView === 'activity'",
  "workspaceView === 'builder'",
  'People & activity ({workflowEnrollments.length})',
  'Workflow builder',
  "setWorkspaceView('builder')",
]

for (const token of automationTokens) {
  if (!automationsSource.includes(token)) failures.push(`Automations is missing: ${token}`)
}

const automationBackendTokens = [
  "router.get('/automation-studio', requireAdmin",
  "router.post('/automation-studio/workflows', requireAdmin",
  "router.put('/automation-studio/workflows/:workflowId', requireAdmin",
  "router.post('/automation-studio/workflows/:workflowId/enroll', requireAdmin",
  "router.post('/automation-studio/enrollments/:enrollmentId/action', requireAdmin",
  "router.post('/automation-studio/run-due', requireAdmin",
  'verifyAutomationClientAccess',
  'processDueAutomationEnrollments({ limit: 50 })',
  "app.use('/api/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminAutomationStudioRoutes)",
]

for (const token of automationBackendTokens) {
  if (!(automationRouteSource + serverAppSource).includes(token)) {
    failures.push(`Automation backend is missing: ${token}`)
  }
}

const preservedActions = [
  [leadsSource, 'updateAdminLead(', 'save a lead'],
  [leadsSource, 'createAdminLeadFollowUp(', 'schedule a follow-up'],
  [leadsSource, 'updateAdminLeadFollowUp(', 'update a follow-up'],
  [leadsSource, 'addAdminLeadNote(', 'add a lead note'],
  [onboardingSource, 'runAdminBookingCommunications()', 'send booking messages'],
  [onboardingSource, 'updateAdminAppointmentOnboarding(', 'save booking rules'],
  [onboardingSource, 'startAdminClientOnboarding(', 'start onboarding'],
  [automationsSource, 'runAdminDueAutomations()', 'process due automation steps'],
  [automationsSource, 'enrollAdminAutomationClient(', 'enroll a client'],
  [automationsSource, 'updateAdminAutomationEnrollment(', 'manage an enrollment'],
]

for (const [source, token, action] of preservedActions) {
  if (!source.includes(token)) failures.push(`Phase 33 no longer exposes the action to ${action}`)
}

if (!packageSource.includes('node scripts/check-admin-phase33-growth-workflows.mjs')) {
  failures.push('package.json does not run the Phase 33 Growth workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 33 Growth workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 33 Growth workflow audit passed (focused lead stages, progressive lead detail, client-first onboarding, focused automation activity, owned backend routes, and preserved actions).',
)
