import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const briefSource = readFileSync('src/pages/admin/AdminDailyBrief.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminDailyBrief',
  'const AdminDailyBrief = lazy(loadAdminDailyBrief)',
  "'/admin/brief': {",
  '<Route path="/admin/brief"',
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
  'aria-live="polite"',
]

const navigationTokens = [
  "to: '/admin/brief'",
  "label: 'Today in The Studio'",
  "module: 'dashboard'",
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
  if (!appSource.includes(token)) failures.push(`Daily Brief route wiring is missing: ${token}`)
}

for (const token of briefTokens) {
  if (!briefSource.includes(token)) failures.push(`Daily Brief safeguard is missing: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`Studio navigation is missing Daily Brief token: ${token}`)
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Daily Brief preloading is missing: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing Daily Brief selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(briefSource)) {
  failures.push('AdminDailyBrief uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-daily-brief.mjs')) {
  failures.push('package.json lint command does not run the Daily Brief audit')
}

if (failures.length) {
  console.error('\nAdmin Daily Brief audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Daily Brief audit passed (${routeTokens.length} route safeguards, ${briefTokens.length} brief safeguards, ${navigationTokens.length} navigation safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
