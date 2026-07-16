import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const plannerSource = readFileSync('src/pages/admin/AdminWeekPlanner.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminWeekPlanner',
  'const AdminWeekPlanner = lazy(loadAdminWeekPlanner)',
  "'/admin/week': {",
  '<Route path="/admin/week"',
]

const plannerTokens = [
  'getAdminAttentionQueue()',
  'getAdminBookings()',
  'getMyTeamAccess()',
  'updateAdminAttentionItem(',
  'const canManageTasks =',
  'const canSeeSessions =',
  'const weekTasks = useMemo',
  'const needsScheduling = useMemo',
  'function moveTask(task, nextDate)',
  'function completeTask(task)',
  'aria-label="Seven-day Studio plan"',
  "navigate('/admin/attention')",
]

const navigationTokens = [
  "to: '/admin/week'",
  "label: 'Studio Week Planner'",
  "module: 'dashboard'",
]

const preloadTokens = [
  'export const loadAdminWeekPlanner',
  "path === '/admin/week'",
]

const stylesheetSelectors = [
  '.pwc-week16-page',
  '.pwc-week16-hero',
  '.pwc-week16-role-card',
  '.pwc-week16-toolbar',
  '.pwc-week16-metrics',
  '.pwc-week16-filters',
  '.pwc-week16-board',
  '.pwc-week16-day',
  '.pwc-week16-task',
  '.pwc-week16-backlog',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`Week Planner route wiring is missing: ${token}`)
}

for (const token of plannerTokens) {
  if (!plannerSource.includes(token)) failures.push(`Week Planner safeguard is missing: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`Studio navigation is missing Week Planner token: ${token}`)
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Week Planner preloading is missing: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing Week Planner selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(plannerSource)) {
  failures.push('AdminWeekPlanner uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-week-planner.mjs')) {
  failures.push('package.json lint command does not run the Week Planner audit')
}

if (failures.length) {
  console.error('\nAdmin Week Planner audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Week Planner audit passed (${routeTokens.length} route safeguards, ${plannerTokens.length} planner safeguards, ${navigationTokens.length} navigation safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
