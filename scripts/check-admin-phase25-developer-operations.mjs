import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const operationsSource = readFileSync('src/pages/admin/AdminDeveloperOperations.jsx', 'utf8')
const panelSource = readFileSync('src/pages/admin/AdminDeveloperPanel.jsx', 'utf8')
const errorsSource = readFileSync('src/pages/admin/AdminDeveloperErrors.jsx', 'utf8')
const integritySource = readFileSync('src/pages/admin/AdminSecurityIntegrity.jsx', 'utf8')
const qaSource = readFileSync('src/pages/admin/AdminReleaseQa.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeSafeguards = [
  'loadAdminDeveloperOperations',
  'const AdminDeveloperOperations = lazy(loadAdminDeveloperOperations)',
  '<Route path="/admin/developer" element={<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>} />',
  '<Route path="/admin/developer/errors" element={<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>} />',
  '<Route path="/admin/developer/integrity" element={<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>} />',
  '<Route path="/admin/developer/qa" element={<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>} />',
]

const sectionSafeguards = [
  "id: 'overview'",
  "id: 'health'",
  "id: 'errors'",
  "id: 'integrity'",
  "id: 'qa'",
  "id: 'access'",
  "id: 'configuration'",
  "legacyPath: '/admin/developer/errors'",
  "legacyPath: '/admin/developer/integrity'",
  "legacyPath: '/admin/developer/qa'",
  'Developer Operations sections',
  'Each section keeps the important data visible without overwhelming the screen.',
  '<AdminDeveloperPanel embedded mode="health" />',
  '<AdminDeveloperErrors embedded />',
  '<AdminSecurityIntegrity embedded />',
  '<AdminReleaseQa embedded />',
  '<AdminDeveloperPanel embedded mode="access" />',
  '<AdminDeveloperPanel embedded mode="configuration" />',
]

const embeddedSafeguards = [
  [panelSource, "{ embedded = false, mode = 'all' }"],
  [panelSource, 'return embedded ? content : <AdminFrame>{content}</AdminFrame>'],
  [errorsSource, '{ embedded = false }'],
  [errorsSource, 'return embedded ? content : <AdminFrame>{content}</AdminFrame>'],
  [integritySource, '{ embedded = false }'],
  [integritySource, 'return embedded ? content : <AdminFrame>{content}</AdminFrame>'],
  [qaSource, '{ embedded = false }'],
  [qaSource, 'return embedded ? content : <AdminFrame>{content}</AdminFrame>'],
]

const visualSafeguards = [
  '.developer-operations-page',
  '.developer-operations-hero',
  '.developer-operations-nav',
  '.developer-operations-section-heading',
  '.developer-control-center.is-embedded',
  '.developer-control-center.developer-mode-health',
  '.developer-error-center-page .error-center-layout',
  '.developer-error-center-page .error-center-list-scroll',
  '.developer-error-center-page .error-center-detail',
  '.developer-operations-content.is-access .developer-tab-bar',
]

for (const token of routeSafeguards) {
  if (!appSource.includes(token)) failures.push(`src/App.jsx is missing unified Developer route safeguard: ${token}`)
}

for (const token of sectionSafeguards) {
  if (!operationsSource.includes(token)) failures.push(`AdminDeveloperOperations is missing section safeguard: ${token}`)
}

for (const [source, token] of embeddedSafeguards) {
  if (!source.includes(token)) failures.push(`Embedded Developer workspace support is missing: ${token}`)
}

for (const selector of visualSafeguards) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing Developer Operations selector: ${selector}`)
}

if (!frameSource.includes("label: 'Developer Operations'")) {
  failures.push('AdminFrame does not expose the unified Developer Operations destination')
}

for (const retiredLabel of ['Developer Control Center', 'Developer Error Center', 'Production Release QA']) {
  const systemStart = frameSource.indexOf("id: 'system'")
  const systemEnd = frameSource.indexOf('const workspaceDefinitions')
  const systemSource = frameSource.slice(systemStart, systemEnd)
  if (systemSource.includes(`label: '${retiredLabel}'`)) {
    failures.push(`AdminFrame still exposes retired separate Developer navigation: ${retiredLabel}`)
  }
}

if (!preloadSource.includes('export const loadAdminDeveloperOperations')) {
  failures.push('Admin route preloaders are missing the unified Developer Operations loader')
}

if (!preloadSource.includes("path.startsWith('/admin/developer/errors')")) {
  failures.push('Developer Error Center compatibility route does not preload unified operations')
}

if (!packageSource.includes('node scripts/check-admin-phase25-developer-operations.mjs')) {
  failures.push('package.json lint command does not run the Phase 25 Developer Operations audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 25 Developer Operations audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 25 Developer Operations audit passed (${routeSafeguards.length} route safeguards, ${sectionSafeguards.length} section safeguards, ${embeddedSafeguards.length} embedded safeguards, ${visualSafeguards.length} visual safeguards).`,
)
