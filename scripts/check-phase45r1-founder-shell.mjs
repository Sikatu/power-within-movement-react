import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const founderSource = read('src/pages/admin/AdminFoundersView.jsx')
const stylesSource = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [founderSource, "document.body.classList.add('admin-app-mode')", 'Founder admin body mode'],
  [founderSource, "document.body.classList.add('founders-view-standalone-mode')", 'Founder standalone body mode'],
  [founderSource, 'className="founder-home__topbar"', 'Founder branded top bar'],
  [founderSource, '/admin/encouragements?view=compose&type=encouragement', 'Founder quick message action'],
  [stylesSource, 'body.admin-app-mode :where(.founder-home,.founder-calendar,.founder-hours)', 'Founder page canvas selector'],
  [stylesSource, 'body.admin-app-mode :where( .founder-home__topbar,.founder-calendar__header,.founder-hours__header )', 'Founder top bar selector'],
  [stylesSource, 'body.admin-app-mode :where( .founder-home__brand,.founder-calendar__brand,.founder-hours__brand )', 'Founder brand selector'],
  [stylesSource, 'body.admin-app-mode :where( .founder-home__top-actions,.founder-calendar__header-actions,.founder-hours__header-actions )', 'Founder action selector'],
  [stylesSource, 'body.admin-app-mode :where( .founder-home__shell,.founder-calendar__shell,.founder-hours__shell )', 'Founder centered shell selector'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const correctedSelectorCount = stylesSource.match(/body\.admin-app-mode :where\(/g)?.length ?? 0

if (stylesSource.includes('body.admin-app-mode:where(')) {
  failures.push('AdminFreshUI.css contains grouped selectors that still target the body instead of its page descendants')
}

if (correctedSelectorCount < 160) {
  failures.push(`Expected the repaired descendant selector family; found only ${correctedSelectorCount}`)
}

if (!packageSource.includes('node scripts/check-phase45r1-founder-shell.mjs')) {
  failures.push('package.json does not run the Phase 45R1 Founder shell audit')
}

if (failures.length) {
  console.error('\nPhase 45R1 Founder shell audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 45R1 Founder shell audit passed (branded standalone header, centered workspace, responsive actions, and repaired grouped admin selectors).',
)
