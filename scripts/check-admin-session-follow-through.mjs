import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
  + readFileSync('src/components/admin/adminNavigation.js', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminSessionFollowThrough.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/sessionFollowThrough.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/sessionFollowThroughSignal.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminSessionFollowThrough',
  'const AdminSessionFollowThrough = lazy(loadAdminSessionFollowThrough)',
  "'/admin/follow-through': {",
  '<Route path="/admin/follow-through"',
]

const pageTokens = [
  'getAdminSessionFollowThrough(days)',
  'const filteredSessions = useMemo',
  'const selectedSession = useMemo',
  'bandOrder',
  'snapshot.viewer?.teamWide',
  'aria-label="Session follow-through board"',
  'This is an operational continuity signal',
  "navigate('/admin/scheduler')",
  "navigate('/admin/attention')",
  "navigate('/admin/inbox')",
  'selectedSession.followThrough?.reasons',
  'openClientResources(selectedSession)',
]

const navigationTokens = [
  "to: '/admin/follow-through'",
  "label: 'Session Follow-Through'",
  "module: 'sessions'",
]

const backendTokens = [
  "router.get('/session-follow-through'",
  'listSessionFollowThrough(req.user, { days: req.query.days })',
  '/api/admin/session-follow-through?days=',
  "if (path === '/session-follow-through') return 'sessions'",
  'function buildSessionFollowThrough(',
  "user?.role === 'staff' ? user.id : null",
  'team_client_assignments viewer_assignment',
  'service_records',
  'client_portal_resources',
  'client_conversations',
]

const preloadTokens = [
  'export const loadAdminSessionFollowThrough',
  "path === '/admin/follow-through'",
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
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing follow-through route token: ${token}`)
}

for (const token of pageTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminSessionFollowThrough is missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing follow-through navigation token: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + apiSource + serviceSource + signalSource + permissionSource).includes(token)) {
    failures.push(`Session follow-through backend is missing safeguard: ${token}`)
  }
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Admin route preloaders are missing follow-through token: ${token}`)
}

for (const selector of reusedVisualSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing reused follow-through selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminSessionFollowThrough uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-session-follow-through.mjs')) {
  failures.push('package.json lint command does not run the Session Follow-Through audit')
}

if (failures.length) {
  console.error('\nAdmin Session Follow-Through audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Session Follow-Through audit passed (${routeTokens.length} route safeguards, ${pageTokens.length} follow-through safeguards, ${backendTokens.length} backend safeguards, ${reusedVisualSelectors.length} reused visual selectors).`,
)
