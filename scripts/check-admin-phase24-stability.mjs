import { readFileSync } from 'node:fs'

const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const paletteSource = readFileSync('src/components/admin/AdminCommandPalette.jsx', 'utf8')
const confirmSource = readFileSync('src/components/admin/AdminConfirmProvider.jsx', 'utf8')
const developerSource = readFileSync('src/pages/admin/AdminDeveloperPanel.jsx', 'utf8')
const lockSource = readFileSync('src/components/admin/adminScrollLock.js', 'utf8')
const circleSource = readFileSync('src/pages/admin/AdminCircleCommunity.jsx', 'utf8')
const momentumSource = readFileSync('src/pages/admin/AdminClientMomentum.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const checklist = readFileSync('docs/admin-phase24-visual-stability.md', 'utf8')

const failures = []

const lockSafeguards = [
  'activeLocks += 1',
  "classList.toggle('admin-scroll-locked', locked)",
  'activeLocks = Math.max(0, activeLocks - 1)',
  "classList.add('admin-app-root')",
  "style.removeProperty('overflow')",
]
for (const token of lockSafeguards) {
  if (!lockSource.includes(token)) failures.push(`scroll-lock utility is missing: ${token}`)
}

for (const [name, source] of [
  ['AdminFrame', frameSource],
  ['AdminCommandPalette', paletteSource],
  ['AdminConfirmProvider', confirmSource],
  ['AdminDeveloperPanel', developerSource],
]) {
  if (source.includes('document.body.style.overflow')) {
    failures.push(`${name} still mutates document.body.style.overflow directly`)
  }
}

for (const token of [
  'mountAdminScrollRoot()',
  'return acquireAdminScrollLock()',
  "window.scrollTo({ top: 0, left: 0, behavior: 'auto' })",
]) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing: ${token}`)
}

const circleSafeguards = [
  'circle-admin-sidebar-heading',
  'circle-composer-fields',
  'circle-field-label',
  'circle-action-meta',
  'circle-action-buttons',
  'aria-selected={activeTab',
]
for (const token of circleSafeguards) {
  if (!circleSource.includes(token)) failures.push(`Circle stabilization is missing: ${token}`)
}

for (const token of ['pwc-momentum18-list-panel', 'pwc-momentum18-list-heading', 'Momentum board']) {
  if (!momentumSource.includes(token)) failures.push(`Momentum stabilization is missing: ${token}`)
}

const visualSafeguards = [
  '--admin-content: 1440px',
  'html.admin-app-root.admin-scroll-locked',
  'body.admin-app-mode .circle-admin-sidebar-heading',
  'body.admin-app-mode .circle-composer-fields',
  'body.admin-app-mode .circle-action-bar',
  '.pwc-momentum18-list-panel',
  '.pwc-momentum18-list-heading',
  '.pwc-momentum18-detail .pwc-capacity17-detail-list',
]

const sidebarSafeguards = [
  'grid-template-rows: auto minmax(0, 1fr) auto;',
  '@media (min-width: 821px)',
  'position: fixed;',
  'height: 100dvh;',
  'margin-left: 260px;',
  'margin-left: 238px;',
  'max-height: min(42dvh, 360px);',
  'overscroll-behavior: contain;',
]
for (const token of visualSafeguards) {
  if (!stylesheet.includes(token)) failures.push(`Phase 24 stylesheet is missing: ${token}`)
}

for (const token of sidebarSafeguards) {
  if (!stylesheet.includes(token)) failures.push(`sidebar continuity is missing: ${token}`)
}

for (const viewport of ['1440 × 900', '1280 × 800', '768 × 1024', '390 × 844']) {
  if (!checklist.includes(viewport)) failures.push(`visual checklist is missing viewport: ${viewport}`)
}

if (!packageSource.includes('node scripts/check-admin-phase24-stability.mjs')) {
  failures.push('package.json lint command does not run the Phase 24 stability audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 24 stability audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 24 stability audit passed (${lockSafeguards.length} scroll safeguards, ${sidebarSafeguards.length} sidebar safeguards, ${circleSafeguards.length} Circle safeguards, 3 Momentum safeguards, ${visualSafeguards.length} visual safeguards).`,
)
