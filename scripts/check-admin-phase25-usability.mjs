import { readFileSync } from 'node:fs'

const operationsSource = readFileSync('src/pages/admin/AdminDeveloperOperations.jsx', 'utf8')
const panelSource = readFileSync('src/pages/admin/AdminDeveloperPanel.jsx', 'utf8')
const errorsSource = readFileSync('src/pages/admin/AdminDeveloperErrors.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const interactionSafeguards = [
  'developer-tab-label',
  'developer-tab-count',
  'const clientPageSize = 6',
  'const visibleClients = useMemo',
  'developer-results-bar',
  'developer-pagination',
  'Showing {filteredClients.length',
  '{visibleClients.map((client) => (',
]

const errorSafeguards = [
  'const monitoringStatus = settingsDraft && (',
  'const headerActions = (',
  'error-center-embedded-commandbar',
  'Error monitoring controls',
  '{embedded ? (',
]

const visualSafeguards = [
  '.developer-control-center .developer-metrics-grid,',
  '.developer-control-center .developer-overview-grid,',
  '.developer-control-center .developer-account-card,',
  '.developer-control-center .developer-client-grid,',
  '.developer-control-center .developer-toggle-list,',
  '.developer-error-center-page .error-center-layout,',
  '.developer-error-center-page .error-center-row,',
  '.developer-error-center-page .error-center-embedded-commandbar',
  '.developer-control-center .developer-account-list{max-height:none;overflow:visible',
  '.developer-control-center .developer-security-list{max-height:none;overflow:visible',
  '.developer-error-center-page .error-center-detail{position:sticky;top:1rem;min-height:0;max-height:none;overflow:visible',
  '.developer-error-center-page .error-center-settings-layout{grid-template-columns:',
]

for (const token of interactionSafeguards) {
  if (!panelSource.includes(token)) failures.push(`Developer account and client UI is missing: ${token}`)
}

for (const token of errorSafeguards) {
  if (!errorsSource.includes(token)) failures.push(`Embedded Error Center usability is missing: ${token}`)
}

for (const token of visualSafeguards) {
  if (!stylesheet.includes(token)) failures.push(`Developer usability CSS is missing: ${token}`)
}

if (!operationsSource.includes('focused technical workspace')) {
  failures.push('Developer Operations does not use the approved user-friendly technical description')
}

if (!operationsSource.includes('Deep link: {activeDefinition.legacyPath}')) {
  failures.push('Developer Operations does not label compatibility paths as deep links')
}

if (!packageSource.includes('node scripts/check-admin-phase25-usability.mjs')) {
  failures.push('package.json lint command does not run the Phase 25 usability audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 25 usability audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 25 usability audit passed (${interactionSafeguards.length} interaction safeguards, ${errorSafeguards.length} Error Center safeguards, ${visualSafeguards.length} visual safeguards).`,
)
