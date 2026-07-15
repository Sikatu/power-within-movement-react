import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminClientMomentum.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/clientMomentum.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/clientMomentumSignal.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminClientMomentum',
  'const AdminClientMomentum = lazy(loadAdminClientMomentum)',
  "'/admin/momentum': {",
  '<Route path="/admin/momentum"',
]

const pageTokens = [
  'getAdminClientMomentum()',
  'const filteredClients = useMemo',
  'const selectedClient = useMemo',
  'signalOrder',
  'snapshot.viewer?.teamWide',
  'aria-label="Client momentum board"',
  'This is an operational care signal, not a rating',
  'openClient(clientId)',
  'openClientTasks(clientId)',
  "navigate('/admin/scheduler')",
  'selectedClient.signal?.reasons',
  'assignedMembers',
]

const navigationTokens = [
  "to: '/admin/momentum'",
  "label: 'Client Momentum'",
  "module: 'clients'",
]

const backendTokens = [
  "router.get('/client-momentum'",
  'listClientMomentum(req.user)',
  "return apiRequest('/api/admin/client-momentum')",
  "if (path === '/client-momentum') return 'clients'",
  'function buildClientMomentum(',
  "user?.role === 'staff' ? user.id : null",
  "cp.client_status IN ('active_client', 'member')",
  'team_client_assignments viewer_assignment',
  'client_conversations',
  'lesson_progress',
]

const preloadTokens = [
  'export const loadAdminClientMomentum',
  "path === '/admin/momentum'",
]

const stylesheetSelectors = [
  '.pwc-momentum18-page',
  '.pwc-momentum18-hero',
  '.pwc-momentum18-toolbar',
  '.pwc-momentum18-grid',
  '.pwc-momentum18-cards',
  '.pwc-momentum18-card',
  '.pwc-momentum18-detail',
  '.pwc-momentum18-focus',
  '.pwc-momentum18-reasons',
  '.pwc-momentum18-actions',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing momentum route token: ${token}`)
}

for (const token of pageTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminClientMomentum is missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing momentum navigation token: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + apiSource + serviceSource + signalSource + permissionSource).includes(token)) {
    failures.push(`Client momentum backend is missing safeguard: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Admin route preloaders are missing momentum token: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing momentum selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminClientMomentum uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-client-momentum.mjs')) {
  failures.push('package.json lint command does not run the Client Momentum audit')
}

if (failures.length) {
  console.error('\nAdmin Client Momentum audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Client Momentum audit passed (${routeTokens.length} route safeguards, ${pageTokens.length} momentum safeguards, ${backendTokens.length} backend safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
