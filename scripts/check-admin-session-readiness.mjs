import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminSessionReadiness.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/sessionReadiness.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/sessionReadinessSignal.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminSessionReadiness',
  'const AdminSessionReadiness = lazy(loadAdminSessionReadiness)',
  "'/admin/readiness': {",
  '<Route path="/admin/readiness"',
]

const pageTokens = [
  'getAdminSessionReadiness(days)',
  'const filteredSessions = useMemo',
  'const selectedSession = useMemo',
  'bandOrder',
  'snapshot.viewer?.teamWide',
  'aria-label="Session readiness board"',
  'This is a preparation signal for the Studio team',
  "navigate('/admin/scheduler')",
  "navigate('/admin/onboarding')",
  "navigate('/admin/attention')",
  "navigate('/admin/inbox')",
  'selectedSession.readiness?.reasons',
]

const navigationTokens = [
  "to: '/admin/readiness'",
  "label: 'Session Readiness'",
  "module: 'sessions'",
]

const backendTokens = [
  "router.get('/session-readiness'",
  'listSessionReadiness(req.user, { days: req.query.days })',
  '/api/admin/session-readiness?days=',
  "if (path === '/session-readiness') return 'sessions'",
  'function buildSessionReadiness(',
  "user?.role === 'staff' ? user.id : null",
  'team_client_assignments viewer_assignment',
  'client_onboarding_records',
  'intake_form_fields',
  'client_conversations',
]

const preloadTokens = [
  'export const loadAdminSessionReadiness',
  "path === '/admin/readiness'",
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
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing readiness route token: ${token}`)
}

for (const token of pageTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminSessionReadiness is missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing readiness navigation token: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + apiSource + serviceSource + signalSource + permissionSource).includes(token)) {
    failures.push(`Session readiness backend is missing safeguard: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Admin route preloaders are missing readiness token: ${token}`)
}

for (const selector of reusedVisualSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing reused readiness selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminSessionReadiness uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-session-readiness.mjs')) {
  failures.push('package.json lint command does not run the Session Readiness audit')
}

if (failures.length) {
  console.error('\nAdmin Session Readiness audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Session Readiness audit passed (${routeTokens.length} route safeguards, ${pageTokens.length} readiness safeguards, ${backendTokens.length} backend safeguards, ${reusedVisualSelectors.length} reused visual selectors).`,
)
