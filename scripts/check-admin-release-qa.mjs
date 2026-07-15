import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminReleaseQa.jsx', 'utf8')
const operationsSource = readFileSync('src/pages/admin/AdminDeveloperOperations.jsx', 'utf8')
const checksSource = readFileSync('src/components/admin/adminReleaseQa.js', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const testSource = readFileSync('server/tests/admin-release-qa.test.cjs', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminDeveloperOperations',
  'const AdminDeveloperOperations = lazy(loadAdminDeveloperOperations)',
  "'/admin/developer/qa': {",
  '<Route path="/admin/developer/qa"',
  '<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>',
]

const workspaceTokens = [
  'RELEASE_QA_CHECKS',
  'RELEASE_QA_VIEWPORTS',
  'Run full QA',
  'Copy report',
  'Read-only live inspection',
  'Responsive visual matrix',
  'Open workspace',
  "navigate('/admin/developer/integrity')",
  "navigate('/admin/developer/errors')",
  'apiRequest(check.endpoint)',
  'for (const check of RELEASE_QA_CHECKS)',
  'inspectReleaseQaResponse',
]

const contractTokens = [
  "endpoint: '/api/auth/developer-check'",
  "endpoint: '/api/admin/overview'",
  "endpoint: '/api/admin/clients'",
  "endpoint: '/api/admin/bookings'",
  "endpoint: '/api/admin/inbox'",
  "endpoint: '/api/admin/attention-queue'",
  "endpoint: '/api/admin/team/workload'",
  "endpoint: '/api/admin/client-momentum'",
  "endpoint: '/api/admin/client-coverage'",
  "endpoint: '/api/admin/session-readiness?days=14'",
  "endpoint: '/api/admin/session-follow-through?days=30'",
  "endpoint: '/api/admin/developer/security-integrity'",
  "endpoint: '/api/admin/developer/system-health'",
  'densityThreshold',
  '2500 ms release threshold',
  'buildReleaseQaReport',
]

const navigationTokens = [
  "legacyPath: '/admin/developer/qa'",
  "label: 'Release QA'",
  "id: 'qa'",
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
  '.pwc-momentum18-focus',
  '.pwc-momentum18-actions',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing release-QA route safeguard: ${token}`)
}

for (const token of workspaceTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminReleaseQa is missing safeguard: ${token}`)
}

for (const token of contractTokens) {
  if (!checksSource.includes(token)) failures.push(`Release QA contracts are missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!(frameSource + operationsSource).includes(token)) failures.push(`Developer Operations is missing release-QA navigation token: ${token}`)
}

if (!preloadSource.includes('export const loadAdminDeveloperOperations')) {
  failures.push('Admin route preloaders are missing the unified Developer Operations loader')
}
if (!preloadSource.includes("path === '/admin/developer/qa'")) {
  failures.push('Admin route preloaders are missing the Production Release QA destination')
}

for (const selector of reusedVisualSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing reused release-QA selector: ${selector}`)
}

if (!testSource.includes('release QA rejects malformed endpoint payloads')) {
  failures.push('Release QA tests do not cover malformed endpoint payloads')
}
if (!testSource.includes('release QA flags high-density and slow responses for review')) {
  failures.push('Release QA tests do not cover density and latency review states')
}
if (!testSource.includes('release QA summary blocks deployment when a check fails')) {
  failures.push('Release QA tests do not cover deployment blocking')
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminReleaseQa uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-release-qa.mjs')) {
  failures.push('package.json lint command does not run the Production Release QA audit')
}
if (!packageSource.includes('node --test server/tests/admin-release-qa.test.cjs')) {
  failures.push('package.json does not expose the focused release-QA contract tests')
}

if (failures.length) {
  console.error('\nAdmin Production Release QA audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const endpointCount = (checksSource.match(/endpoint:\s*['"]/g) || []).length
console.log(
  `Admin Production Release QA audit passed (${routeTokens.length} route safeguards, ${workspaceTokens.length} workspace safeguards, ${endpointCount} read-only endpoint contracts, ${reusedVisualSelectors.length} reused visual selectors).`,
)
