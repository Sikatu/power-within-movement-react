import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const activitySource = readFileSync('src/pages/admin/AdminActivityCenter.jsx', 'utf8')
const notificationSource = readFileSync('src/components/NotificationCenter.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminActivityCenter',
  'const AdminActivityCenter = lazy(loadAdminActivityCenter)',
  "'/admin/activity': {",
  '<Route path="/admin/activity"',
]

const activityTokens = [
  'getAdminNotifications({ limit: 100 })',
  'getMyTeamAccess()',
  'const visibleCategories = useMemo',
  'hasPermission(teamAccess, definition.modules)',
  'const groupedNotifications = useMemo',
  "setReadState('all')",
  "setImportance('all')",
  'markAllAdminNotificationsRead()',
  'clearReadAdminNotifications()',
  'dismissAdminNotification(notification.id)',
  'markAdminNotificationRead(notification.id)',
  'const confirmAction = useAdminConfirm()',
  'role="group" aria-label="Filter by activity category"',
  'aria-live="polite"',
]

const navigationTokens = [
  "to: '/admin/activity'",
  "label: 'Studio Activity'",
  "module: 'dashboard'",
]

const notificationTokens = [
  'function openFullActivity()',
  "navigate('/admin/activity')",
  'Open activity center',
]

const preloadTokens = [
  'export const loadAdminActivityCenter',
  "path === '/admin/activity'",
]

const stylesheetSelectors = [
  '.pwc-activity13-page',
  '.pwc-activity13-hero',
  '.pwc-activity13-role-card',
  '.pwc-activity13-metrics',
  '.pwc-activity13-workspace',
  '.pwc-activity13-category-filter',
  '.pwc-activity13-controls',
  '.pwc-activity13-groups',
  '.pwc-activity13-item',
  '.pwc-activity13-empty',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`App route wiring is missing: ${token}`)
}

for (const token of activityTokens) {
  if (!activitySource.includes(token)) failures.push(`Activity Center safeguard is missing: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`Studio navigation is missing activity token: ${token}`)
}

for (const token of notificationTokens) {
  if (!notificationSource.includes(token)) failures.push(`Notification drawer is missing activity token: ${token}`)
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Activity route preloading is missing: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing Activity Center selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(activitySource)) {
  failures.push('AdminActivityCenter uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-activity-center.mjs')) {
  failures.push('package.json lint command does not run the Activity Center audit')
}

if (failures.length) {
  console.error('\nAdmin Activity Center audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Activity Center audit passed (${routeTokens.length} route safeguards, ${activityTokens.length} activity safeguards, ${navigationTokens.length} navigation safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
