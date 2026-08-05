import { readFileSync } from 'node:fs'

const dashboardSource = readFileSync(
  'src/pages/admin/AdminDashboard.jsx',
  'utf8',
)
const briefSource = readFileSync(
  'src/pages/admin/AdminDailyBrief.jsx',
  'utf8',
)
const clientsSource = readFileSync(
  'src/pages/admin/AdminClients.jsx',
  'utf8',
)
const schedulerSource = readFileSync(
  'src/pages/admin/AdminScheduler.jsx',
  'utf8',
)
const inboxSource = readFileSync(
  'src/pages/admin/AdminInbox.jsx',
  'utf8',
)
const stylesheet = readFileSync(
  'src/pages/admin/AdminFreshUI.css',
  'utf8',
)
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const schedulerTokens = [
  "const [workspaceView, setWorkspaceView] = useState('requests')",
  'className="pwc-scheduler-view-tabs"',
  "workspaceView === 'requests'",
  "workspaceView === 'types'",
  "workspaceView === 'availability'",
  'aria-label="Sessions workspace"',
  'Preview booking page',
]

for (const token of schedulerTokens) {
  if (!schedulerSource.includes(token)) {
    failures.push(`Sessions is missing: ${token}`)
  }
}

const clientTokens = [
  'showClientFilters',
  'advancedClientFilterCount',
  'id="client-advanced-filters"',
  'aria-controls="client-advanced-filters"',
  'className="client-directory-toolbar-v4"',
  'placeholder="Search clients"',
]

for (const token of clientTokens) {
  if (!clientsSource.includes(token)) {
    failures.push(`Clients is missing: ${token}`)
  }
}

const messageTokens = [
  'showFilters',
  'activeFilterCount',
  'function resetFilters()',
  'className="admin-inbox__toolbar"',
  'id="inbox-advanced-filters"',
  "status: 'waiting_on_team'",
  'Reply to clients, leave private team notes',
]

for (const token of messageTokens) {
  if (!inboxSource.includes(token)) {
    failures.push(`Messages is missing: ${token}`)
  }
}

const todayTokens = [
  "import AdminDailyBrief from './AdminDailyBrief.jsx'",
  '<AdminDailyBrief embedded />',
]

for (const token of todayTokens) {
  if (!dashboardSource.includes(token)) {
    failures.push(`Today is missing: ${token}`)
  }
}

const todayWorkflowTokens = [
  'const focusTasks = useMemo',
  'const upcomingSessions = useMemo',
  'const priorityActivity = useMemo',
  "navigate('/admin/readiness')",
  "navigate('/admin/follow-through')",
]

for (const token of todayWorkflowTokens) {
  if (!briefSource.includes(token)) {
    failures.push(`Today workflow is missing: ${token}`)
  }
}

const stylesheetSelectors = [
  '.pwc-brief15-page',
  '.pwc-scheduler-view-tabs',
  '.admin-inbox__toolbar',
  '.client-directory-toolbar-v4',
  '.client-advanced-filters-v4',
  'phase-32-daily-workflow-streamlining-end',
]

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) {
    failures.push(`AdminFreshUI.css is missing: ${selector}`)
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase32-daily-workflows.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 32 daily workflow audit',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 32 daily workflow audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  'Admin Phase 32 daily workflow audit passed (one canonical Today page, priority work, upcoming sessions, activity, preparation and follow-through actions, compact Client and Messages filters, and preserved workflow controls).',
)
