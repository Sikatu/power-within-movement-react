import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
  + readFileSync('src/components/admin/adminNavigation.js', 'utf8')
const capacitySource = readFileSync('src/pages/admin/AdminCapacityCenter.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/teamWorkload.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/teamWorkloadSignal.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminCapacityCenter',
  'const AdminCapacityCenter = lazy(loadAdminCapacityCenter)',
  "'/admin/capacity': {",
  '<Route path="/admin/capacity"',
]

const capacityTokens = [
  'getAdminTeamWorkload()',
  'getMyTeamAccess()',
  'updateAdminAttentionItem(',
  'const canManageTasks =',
  'const filteredMembers = useMemo',
  'const selectedTasks = useMemo',
  'const selectedSessions = useMemo',
  'function eligibleMembers(task)',
  'function assignTask(task, ownerUserId)',
  'aria-label="Team workload board"',
  "navigate('/admin/attention')",
  'snapshot.viewer?.teamWide',
]

const navigationTokens = [
  "to: '/admin/capacity'",
  "label: 'Studio Capacity'",
  "module: 'dashboard'",
]

const backendTokens = [
  "router.get('/team/workload'",
  'listTeamWorkload(req.user)',
  "return apiRequest('/api/admin/team/workload')",
  "if (path === '/team/workload') return 'dashboard'",
  'function calculateLoadSignal(',
  'function buildMemberSnapshot(',
  'listAttentionQueue(user, db)',
  "user?.role === 'staff' ? user.id : null",
  'eligibleOwnerIds:',
  'unassignedSessions',
]

const preloadTokens = [
  'export const loadAdminCapacityCenter',
  "path === '/admin/capacity'",
]

const stylesheetSelectors = [
  '.pwc-capacity17-page',
  '.pwc-capacity17-hero',
  '.pwc-capacity17-toolbar',
  '.pwc-capacity17-grid',
  '.pwc-capacity17-card',
  '.pwc-capacity17-meter',
  '.pwc-capacity17-stats',
  '.pwc-capacity17-task',
  '.pwc-capacity17-detail',
  '.pwc-capacity17-empty',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`Capacity Center route wiring is missing: ${token}`)
}

for (const token of capacityTokens) {
  if (!capacitySource.includes(token)) failures.push(`Capacity Center safeguard is missing: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`Studio navigation is missing capacity token: ${token}`)
}

for (const token of backendTokens) {
  if (!(apiSource + routeSource + serviceSource + signalSource + permissionSource).includes(token)) {
    failures.push(`Capacity backend safeguard is missing: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Capacity Center preloading is missing: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing capacity selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(capacitySource)) {
  failures.push('AdminCapacityCenter uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-capacity-center.mjs')) {
  failures.push('package.json lint command does not run the Capacity Center audit')
}

if (failures.length) {
  console.error('\nAdmin Capacity Center audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Capacity Center audit passed (${routeTokens.length} route safeguards, ${capacityTokens.length} capacity safeguards, ${backendTokens.length} backend safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
