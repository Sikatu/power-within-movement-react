import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const styles = read('src/pages/admin/AdminFreshUI.css')
const memberships = read('src/pages/admin/AdminMembershipCircle.jsx')
const onboarding = read('src/pages/admin/AdminOnboardingStudio.jsx')
const visualAudit = read('scripts/check-admin-visual-coverage.mjs')
const packageSource = read('package.json')
const docs = read('docs/phase53-admin-visual-acceptance.md')
const failures = []

const requirements = [
  [styles, 'phase-53-visual-acceptance-start', 'scoped Phase 53 style layer'],
  [styles, '.automation-studio-header-actions .pwc-admin-primary-button', 'clear automation primary action'],
  [styles, '.pwc-assets26-hero-actions > button:not(.is-secondary)', 'clear Asset Vault primary action'],
  [styles, 'grid-template-columns: repeat(5, minmax(0, 1fr))', 'balanced five-card metric rows'],
  [styles, '@media (forced-colors: active)', 'high-contrast action boundary'],
  [memberships, 'aria-label="Membership summary"', 'named membership metrics'],
  [onboarding, 'aria-label="Onboarding summary"', 'named onboarding metrics'],
  [visualAudit, 'const stylesheetBudget = 568 * 1024', 'bounded stylesheet budget'],
  [packageSource, '"admin:qa:phase53"', 'focused Phase 53 QA command'],
  [docs, 'Twelve-route acceptance matrix', 'documented route matrix'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const darkHeaders = [
  '.learning-library-header',
  '.membership-circle-header',
  '.circle-admin-header',
  '.automation-studio-header',
  '.onboarding-studio-header',
  '.pwc-assets26-hero',
  '.pwc-letters28-hero',
  '.admin-inbox__header',
  '.lead-pipeline-header',
]

for (const selector of darkHeaders) {
  if (!styles.includes(selector)) failures.push(`dark-header coverage is missing: ${selector}`)
}

if (failures.length) {
  console.error('\nPhase 53 admin visual acceptance audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Phase 53 admin visual acceptance audit passed (${darkHeaders.length} dark headers, 4 priority-action safeguards, balanced five-card metrics, named summaries, and bounded responsive styles).`,
)
