import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const pageSource = readFileSync('src/pages/admin/AdminSecurityIntegrity.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const serverAppSource = readFileSync('server/src/app.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const authSource = readFileSync('server/src/middleware/auth.middleware.js', 'utf8')
const authRouteSource = readFileSync('server/src/routes/auth.routes.js', 'utf8')
const middlewareSource = readFileSync('server/src/middleware/securityIntegrity.middleware.js', 'utf8')
const requestPolicySource = readFileSync('server/src/middleware/securityRequestPolicy.js', 'utf8')
const serviceSource = readFileSync('server/src/services/securityIntegrity.service.js', 'utf8')
const signalSource = readFileSync('server/src/services/securityIntegritySignal.js', 'utf8')
const testSource = readFileSync('server/tests/security-integrity.test.cjs', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminSecurityIntegrity',
  'const AdminSecurityIntegrity = lazy(loadAdminSecurityIntegrity)',
  "'/admin/developer/integrity': {",
  '<Route path="/admin/developer/integrity"',
  '<AdminDeveloperRouteGuard><AdminSecurityIntegrity /></AdminDeveloperRouteGuard>',
]

const pageTokens = [
  'getDeveloperSecurityIntegrity()',
  'const filteredChecks = useMemo',
  'const selectedCheck = useMemo',
  'Developer-only audit',
  'Findings are read-only',
  'aria-label="Security and integrity checks"',
  "navigate('/admin/developer')",
  "navigate('/admin/team')",
  "navigate('/admin/audit-log')",
  "navigate('/admin/developer/errors')",
]

const navigationTokens = [
  "to: '/admin/developer/integrity'",
  "label: 'Security & Data Integrity'",
  'developerOnly: true',
]

const backendTokens = [
  "router.get('/developer/security-integrity', requireDeveloper",
  'getSecurityIntegritySnapshot()',
  '/api/admin/developer/security-integrity',
  'buildSecurityIntegrityChecks',
  'buildIntegritySummary',
  'team_member_permissions',
  'orphan_operational_records',
  'invalid_session_versions',
]

const securityTokens = [
  'enforceTrustedMutation',
  'sensitiveResponseHeaders',
  "code: 'TRUSTED_ORIGIN_REQUIRED'",
  "'Cache-Control': 'no-store, max-age=0'",
  "algorithms: ['HS256']",
  'clockTolerance: 5',
  'development_without_origin',
  'origin_mismatch',
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
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing security-integrity route safeguard: ${token}`)
}

for (const token of pageTokens) {
  if (!pageSource.includes(token)) failures.push(`AdminSecurityIntegrity is missing safeguard: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing security-integrity navigation token: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + apiSource + serviceSource + signalSource).includes(token)) {
    failures.push(`Security-integrity backend is missing safeguard: ${token}`)
  }
}

for (const token of securityTokens) {
  if (!(serverAppSource + middlewareSource + requestPolicySource + authSource + authRouteSource).includes(token)) {
    failures.push(`Protected-request hardening is missing safeguard: ${token}`)
  }
}

if (!preloadSource.includes('export const loadAdminSecurityIntegrity')) {
  failures.push('Admin route preloaders are missing the Security & Data Integrity loader')
}
if (!preloadSource.includes("path === '/admin/developer/integrity'")) {
  failures.push('Admin route preloaders are missing the Security & Data Integrity destination')
}

for (const selector of reusedVisualSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing reused security-integrity selector: ${selector}`)
}

const mutationRoutes = [...routeSource.matchAll(/router\.(post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)]
for (const mutation of mutationRoutes) {
  const routeWindow = routeSource.slice(mutation.index, mutation.index + 500)
  if (!/require(?:Admin|Developer|FounderAccess)/.test(routeWindow)) {
    failures.push(`Admin mutation route lacks an explicit protected middleware chain: ${mutation[1].toUpperCase()} ${mutation[2]}`)
  }
}

if (!serverAppSource.includes("app.use('/api/auth', sensitiveResponseHeaders, enforceTrustedMutation, authRoutes)")) {
  failures.push('Authentication routes are not mounted behind no-store and trusted-mutation middleware')
}
if (!serverAppSource.includes("app.use('/api/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminRoutes)")) {
  failures.push('Admin routes are not mounted behind no-store and trusted-mutation middleware')
}
if (!serverAppSource.includes("app.use('/api/public/client-portal', sensitiveResponseHeaders, enforceTrustedMutation)")) {
  failures.push('Client portal routes are not mounted behind no-store and trusted-mutation middleware')
}

if (!testSource.includes('cookie-authenticated mutation rejects an unapproved production origin')) {
  failures.push('Security integrity tests do not cover cross-origin mutation rejection')
}
if (!testSource.includes('integrity checks surface canonical-account and staff permission gaps')) {
  failures.push('Security integrity tests do not cover account and permission gaps')
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(pageSource)) {
  failures.push('AdminSecurityIntegrity uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-security-integrity.mjs')) {
  failures.push('package.json lint command does not run the Security & Data Integrity audit')
}

if (failures.length) {
  console.error('\nAdmin Security & Data Integrity audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Security & Data Integrity audit passed (${routeTokens.length} route safeguards, ${pageTokens.length} workspace safeguards, ${backendTokens.length} backend safeguards, ${securityTokens.length} request-security safeguards, ${mutationRoutes.length} protected mutation routes).`,
)
