import { readFileSync } from 'node:fs'

const leadsSource = readFileSync('src/pages/admin/AdminLeadPipeline.jsx', 'utf8')
const onboardingSource = readFileSync('src/pages/admin/AdminOnboardingStudio.jsx', 'utf8')
const automationsSource = readFileSync('src/pages/admin/AdminAutomationStudio.jsx', 'utf8')
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
  'Admin Phase 33 Growth workflow audit passed (focused lead stages, progressive lead detail, client-first onboarding, focused automation activity, and preserved backend actions).',
)
