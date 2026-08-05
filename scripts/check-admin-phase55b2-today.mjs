import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const read = (path) => readFileSync(path, 'utf8')
  .replace(/\r\n?/g, '\n')

const appSource = read('src/App.jsx')
const dashboardSource = read(
  'src/pages/admin/AdminDashboard.jsx',
)
const briefSource = read(
  'src/pages/admin/AdminDailyBrief.jsx',
)
const guidanceSource = read(
  'src/components/admin/adminPageGuidance.js',
)
const packageSource = read('package.json')
const failures = []

const dashboardTokens = [
  "import AdminFrame from '../../components/admin/AdminFrame.jsx'",
  "import AdminDailyBrief from './AdminDailyBrief.jsx'",
  '<AdminDailyBrief embedded />',
]

for (const token of dashboardTokens) {
  if (!dashboardSource.includes(token)) {
    failures.push(
      `Canonical Today page is missing: ${token}`,
    )
  }
}

const retiredDashboardTokens = [
  'getAdminOverview',
  'getAdminAuditLogs',
  'studio-dashboard-v3',
  'Follow-Up Care Queue',
]

for (const token of retiredDashboardTokens) {
  if (dashboardSource.includes(token)) {
    failures.push(
      `Retired duplicate dashboard logic remains: ${token}`,
    )
  }
}

const todayTokens = [
  '<p className="admin-eyebrow">Today</p>',
  'Your next five actions',
  'Review priorities',
  'Refresh Today',
  "navigate('/admin/clients')",
  "navigate('/admin/inbox')",
  "navigate('/admin/scheduler')",
  "navigate('/admin/readiness')",
  "navigate('/admin/follow-through')",
  "navigate('/admin/leads')",
  '<strong>Clients</strong>',
  '<strong>Messages</strong>',
  '<strong>Prepare Sessions</strong>',
  '<strong>Follow-Through</strong>',
]

for (const token of todayTokens) {
  if (!briefSource.includes(token)) {
    failures.push(
      `Today experience is missing: ${token}`,
    )
  }
}

const retiredTodayTokens = [
  '<strong>Client Circle</strong>',
  '<strong>Secure Inbox</strong>',
  '>Activity center</button>',
  '>Open attention queue</button>',
]

for (const token of retiredTodayTokens) {
  if (briefSource.includes(token)) {
    failures.push(
      `Retired Today terminology remains: ${token}`,
    )
  }
}

if (
  workspacePrimaryItems.studio[0]?.to !== '/admin/dashboard'
  || workspacePrimaryItems.studio[0]?.label !== 'Today'
) {
  failures.push(
    'Today is not the first primary Studio destination.',
  )
}

const discoverablePaths = studioGroups.flatMap(
  (group) => group.items.map((item) => item.to),
)

if (discoverablePaths.includes('/admin/brief')) {
  failures.push(
    'The duplicate Daily Brief remains in More or Quick Find.',
  )
}

if (!appSource.includes('<Route path="/admin/brief"')) {
  failures.push(
    'The legacy /admin/brief route was removed instead of preserved.',
  )
}

if (
  !appSource.includes("'/admin/brief': {")
  || !appSource.includes("title: 'Today | The Studio'")
) {
  failures.push(
    'The legacy Today route does not use unified metadata.',
  )
}

if (
  !guidanceSource.includes(
    "if (pathname === '/admin/brief') return PAGE_GUIDES['/admin/dashboard']",
  )
) {
  failures.push(
    'The legacy Today route does not reuse Today guidance.',
  )
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55b2-today.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55B.2 Today audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55B.2 Today audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  `Admin Phase 55B.2 Today audit passed (one canonical Today page, six direct daily actions, ${discoverablePaths.length} specialist destinations without a duplicate brief, preserved legacy routing, and shared guidance).`,
)
