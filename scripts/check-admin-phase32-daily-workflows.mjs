import { readFileSync } from 'node:fs'

const dashboardSource = readFileSync('src/pages/admin/AdminDashboard.jsx', 'utf8')
const clientsSource = readFileSync('src/pages/admin/AdminClients.jsx', 'utf8')
const schedulerSource = readFileSync('src/pages/admin/AdminScheduler.jsx', 'utf8')
const inboxSource = readFileSync('src/pages/admin/AdminInbox.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
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
  if (!schedulerSource.includes(token)) failures.push(`Sessions is missing: ${token}`)
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
  if (!clientsSource.includes(token)) failures.push(`Clients is missing: ${token}`)
}

const inboxTokens = [
  'showFilters',
  'activeFilterCount',
  'function resetFilters()',
  'className="admin-inbox__toolbar"',
  'id="inbox-advanced-filters"',
  "status: 'waiting_on_team'",
  'Reply to clients, leave private team notes',
]

for (const token of inboxTokens) {
  if (!inboxSource.includes(token)) failures.push(`Inbox is missing: ${token}`)
}

const dashboardTokens = [
  'studio-focus-actions-v4',
  '<Link to="/admin/clients">Open clients</Link>',
  '<Link to="/admin/scheduler">Review sessions</Link>',
  'to={metric.href}',
]

for (const token of dashboardTokens) {
  if (!dashboardSource.includes(token)) failures.push(`Overview is missing: ${token}`)
}

if (dashboardSource.includes('<section className="studio-rooms-v3">')) {
  failures.push('Overview still renders the redundant room directory')
}

const stylesheetSelectors = [
  '.studio-focus-actions-v4',
  '.pwc-scheduler-view-tabs',
  '.admin-inbox__toolbar',
  '.client-directory-toolbar-v4',
  '.client-advanced-filters-v4',
  'phase-32-daily-workflow-streamlining-end',
]

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing: ${selector}`)
}

if (!packageSource.includes('node scripts/check-admin-phase32-daily-workflows.mjs')) {
  failures.push('package.json does not run the Phase 32 daily workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 32 daily workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 32 daily workflow audit passed (3 focused session modes, compact Client and Inbox filters, actionable Overview metrics, and preserved workflow controls).',
)
