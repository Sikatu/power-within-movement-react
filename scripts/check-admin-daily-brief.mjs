import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const dashboardSource = readFileSync(
  'src/pages/admin/AdminDashboard.jsx',
  'utf8',
)
const briefSource = readFileSync(
  'src/pages/admin/AdminDailyBrief.jsx',
  'utf8',
)
const navigationSource = readFileSync(
  'src/components/admin/adminNavigation.js',
  'utf8',
)
const preloadSource = readFileSync(
  'src/components/admin/adminRoutePreloaders.js',
  'utf8',
)
const stylesheet = readFileSync(
  'src/pages/admin/AdminFreshUI.css',
  'utf8',
)
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const routeTokens = [
  'loadAdminDailyBrief',
  'const AdminDailyBrief = lazy(loadAdminDailyBrief)',
  "'/admin/brief': {",
  '<Route path="/admin/brief"',
]

const dashboardTokens = [
  "import AdminDailyBrief from './AdminDailyBrief.jsx'",
  '<AdminDailyBrief embedded />',
]

const briefTokens = [
  'getAdminAttentionQueue()',
  'getAdminBookings()',
  'getAdminNotifications({ limit: 40 })',
  'getMyTeamAccess()',
  'markAdminNotificationRead(notification.id)',
  'const focusTasks = useMemo',
  'const upcomingSessions = useMemo',
  'const priorityActivity = useMemo',
  'const canSeeSessions =',
  "navigate('/admin/attention')",
  "navigate('/admin/activity')",
  "navigate('/admin/readiness')",
  "navigate('/admin/follow-through')",
  'aria-live="polite"',
]

const preloadTokens = [
  'export const loadAdminDailyBrief',
  "path === '/admin/brief'",
]

const stylesheetSelectors = [
  '.pwc-brief15-page',
  '.pwc-brief15-hero',
  '.pwc-brief15-readiness',
  '.pwc-brief15-metrics',
  '.pwc-brief15-grid',
  '.pwc-brief15-focus-list',
  '.pwc-brief15-session-list',
  '.pwc-brief15-activity-list',
  '.pwc-brief15-shortcuts',
  '.pwc-brief15-empty',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) {
    failures.push(`Today legacy-route wiring is missing: ${token}`)
  }
}

for (const token of dashboardTokens) {
  if (!dashboardSource.includes(token)) {
    failures.push(`Canonical Today integration is missing: ${token}`)
  }
}

for (const token of briefTokens) {
  if (!briefSource.includes(token)) {
    failures.push(`Today safeguard is missing: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) {
    failures.push(`Today legacy-route preloading is missing: ${token}`)
  }
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) {
    failures.push(
      `AdminFreshUI.css is missing Today selector: ${selector}`,
    )
  }
}

if (navigationSource.includes("to: '/admin/brief'")) {
  failures.push(
    'The duplicate Daily Brief destination remains discoverable.',
  )
}

if (
  /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(
    briefSource,
  )
) {
  failures.push('AdminDailyBrief uses a native browser dialog')
}

if (
  !packageSource.includes(
    'node scripts/check-admin-daily-brief.mjs',
  )
) {
  failures.push(
    'package.json lint command does not run the Today audit',
  )
}

if (failures.length) {
  console.error('\nAdmin Today audit failed:\n')

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  `Admin Today audit passed (${routeTokens.length} legacy-route safeguards, ${dashboardTokens.length} canonical-dashboard safeguards, ${briefTokens.length} daily-work safeguards, and ${stylesheetSelectors.length} visual selectors).`,
)
