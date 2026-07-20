import { readFileSync } from 'node:fs'

const panel = readFileSync('src/pages/admin/AdminDeveloperPanel.jsx', 'utf8')
const qa = readFileSync('src/pages/admin/AdminReleaseQa.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const migration = readFileSync('server/scripts/ensure-developer-error-center.cjs', 'utf8')
const service = readFileSync('server/src/services/developerErrorCenter.service.js', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const visualSafeguards = [
  '.developer-control-center .developer-tab-bar button.is-active .developer-tab-count',
  '.developer-control-save-bar{grid-column:1/-1',
  '.developer-control-save-bar>div{gap:.12rem;display:grid}',
  '.developer-controls-layout>.developer-panel-card:nth-child(2) .developer-toggle-list.compact{grid-template-columns:repeat(2,minmax(0,1fr))}',
  'width:auto;min-width:6.6rem',
  'white-space:nowrap',
]

for (const token of visualSafeguards) {
  if (!stylesheet.includes(token)) failures.push(`Developer finishing stylesheet is missing: ${token}`)
}

if (!panel.includes('<span className="developer-tab-count"')) {
  failures.push('Client Access attention count is not rendered as a separate badge')
}

if (!qa.includes('Resolve before production deployment')) {
  failures.push('Release QA still references the retired Phase 24 deployment wording')
}

if (!migration.includes('application_errors_fingerprint_unique') || !migration.includes('UNIQUE (fingerprint)')) {
  failures.push('Developer Error Center migration does not repair the fingerprint uniqueness contract')
}

if (!service.includes('ON CONFLICT ON CONSTRAINT application_errors_fingerprint_unique')) {
  failures.push('Developer Error Center no longer deduplicates persisted reports by fingerprint')
}

if (!packageSource.includes('node scripts/check-admin-phase25r1-finish.mjs')) {
  failures.push('package.json does not run the Phase 25R.1 finishing audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 25R.1 finishing audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 25R.1 finishing audit passed (${visualSafeguards.length} visual safeguards, 1 release-language safeguard, 2 Error Center persistence safeguards).`,
)
