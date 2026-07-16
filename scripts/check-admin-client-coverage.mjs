import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminClientCoverage.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/clientCoverage.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/clientCoverageSignal.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminClientCoverage',
  'const AdminClientCoverage = lazy(loadAdminClientCoverage)',
  "'/admin/coverage': {",
  '<Route path="/admin/coverage"',
]

const pageTokens = [
  'getAdminClientCoverage()',
  'const filteredClients = useMemo',
  'const selectedClient = useMemo',
  'coverageOrder',
  'snapshot.viewer?.teamWide',
  'aria-label="Client coverage board"',
  'This is an operational continuity signal',
  "navigate('/admin/capacity')",
  "navigate('/admin/scheduler')",
  "navigate('/admin/inbox')",
  'selectedClient.coverage?.reasons',
  "navigate('/admin/team')",
]

const navigationTokens = [
  "to: '/admin/coverage'",
  "label: 'Coverage & Handoffs'",
  "module: 'clients'",
]

const backendTokens = [
  "router.get('/client-coverage'",
  'listClientCoverage(req.user)',
  '/api/admin/client-coverage',
  "if (path === '/client-coverage') return 'clients'",
  'function buildClientCoverage(',
  "user?.role === 'staff' ? user.id : null",
  'team_client_assignments viewer_assignment',
  'team_member_profiles',
  'client_conversations',
  'listAttentionQueue(user, db)',
]

const preloadTokens = [
  'export const loadAdminClientCoverage',
  "path === '/admin/coverage'",
]

const reusedVisualSelectors = [
  '.pwc-week16-page',
  '.pwc-week16-hero',
  '.pwc-week16-toolbar',
  '.pwc-week16-metrics',
  '.pwc-week16-filters',
  '.pwc-capacity17-grid',
  '.pwc-capacity17-card',
  '.pwc-momentum18-detail',
  '.pwc-momentum18-reasons',
  '.pwc-momentum18-actions',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing client coverage route token: ${token}`)
}

for (const token of pageTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminClientCoverage is missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing coverage navigation token: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + apiSource + serviceSource + signalSource + permissionSource).includes(token)) {
    failures.push(`Client coverage backend is missing safeguard: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Admin route preloaders are missing coverage token: ${token}`)
}

for (const selector of reusedVisualSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing reused coverage selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminClientCoverage uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-client-coverage.mjs')) {
  failures.push('package.json lint command does not run the Client Coverage audit')
}

if (failures.length) {
  console.error('\nAdmin Client Coverage audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Client Coverage audit passed (${routeTokens.length} route safeguards, ${pageTokens.length} coverage safeguards, ${backendTokens.length} backend safeguards, ${reusedVisualSelectors.length} reused visual selectors).`,
)
