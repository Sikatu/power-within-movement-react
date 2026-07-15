import { readFileSync } from 'node:fs'

const operations = readFileSync('src/pages/admin/AdminDeveloperOperations.jsx', 'utf8')
const panel = readFileSync('src/pages/admin/AdminDeveloperPanel.jsx', 'utf8')
const errors = readFileSync('src/pages/admin/AdminDeveloperErrors.jsx', 'utf8')
const integrity = readFileSync('src/pages/admin/AdminSecurityIntegrity.jsx', 'utf8')
const qa = readFileSync('src/pages/admin/AdminReleaseQa.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const shellSafeguards = [
  'Private developer command center',
  'developer-operations-meta',
  'developer-operations-nav-icon',
  'developer-operations-section-index',
  'Protected</strong> developer access',
]

const interactionSafeguards = [
  'const [clientPage, setClientPage] = useState(1)',
  'const clientPageSize = 6',
  'developer-results-bar',
  'developer-pagination',
  'visibleClients.map',
]

const errorSafeguards = [
  'error-center-commandbar',
  'Incident monitor',
  '<details className="error-center-settings">',
  'error-center-settings-body',
  'error-center-refresh-button',
]

const embeddedSafeguards = [
  [integrity, '{!embedded && ('],
  [qa, '{!embedded && ('],
  [integrity, 'developer-audit-workspace'],
  [qa, 'developer-release-workspace'],
]

const visualSafeguards = [
  '.developer-operations-kicker',
  '.developer-operations-live-dot',
  '.developer-operations-nav-icon',
  '.developer-operations-section-index',
  '.developer-control-center .developer-tab-bar',
  '.developer-metrics-grid',
  '.developer-overview-grid',
  '.developer-account-card',
  '.developer-client-grid',
  '.developer-controls-layout',
  '.error-center-commandbar',
  '.error-center-layout',
  '.error-center-settings-body',
  '.developer-audit-workspace',
  '.developer-release-workspace',
  '.developer-operations-content.is-errors .error-center-detail',
]

for (const token of shellSafeguards) {
  if (!operations.includes(token)) failures.push(`Developer Operations shell is missing: ${token}`)
}

for (const token of interactionSafeguards) {
  if (!panel.includes(token)) failures.push(`Developer account/client workflow is missing: ${token}`)
}

for (const token of errorSafeguards) {
  if (!errors.includes(token)) failures.push(`Premium Error Center is missing: ${token}`)
}

for (const [source, token] of embeddedSafeguards) {
  if (!source.includes(token)) failures.push(`Embedded technical workspace is missing: ${token}`)
}

for (const selector of visualSafeguards) {
  if (!stylesheet.includes(selector)) failures.push(`Premium Developer stylesheet is missing: ${selector}`)
}

if (errors.includes('<h1>Developer Error Center</h1>')) {
  failures.push('The embedded Error Center still renders its retired duplicate page hero')
}

if (!packageSource.includes('node scripts/check-admin-phase25-premium.mjs')) {
  failures.push('package.json does not run the premium Developer Operations audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 25 premium redesign audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 25 premium redesign audit passed (${shellSafeguards.length} shell safeguards, ${interactionSafeguards.length} workflow safeguards, ${errorSafeguards.length} Error Center safeguards, ${embeddedSafeguards.length} embedded safeguards, ${visualSafeguards.length} visual safeguards).`,
)
