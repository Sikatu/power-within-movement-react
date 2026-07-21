import { readFileSync } from 'node:fs'

import {
  ADMIN_COMFORT_STORAGE_KEY,
  readAdminComfortView,
  writeAdminComfortView,
} from '../src/components/admin/adminDisplayPreferences.js'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const frame = read('src/components/admin/AdminFrame.jsx')
const help = read('src/components/admin/AdminHelpCenter.jsx')
const preferenceSource = read('src/components/admin/adminDisplayPreferences.js')
const styles = read('src/pages/admin/AdminFreshUI.css')
const visualAudit = read('scripts/check-admin-visual-coverage.mjs')
const packageSource = read('package.json')
const docs = read('docs/phase52-admin-comfort-view.md')
const failures = []

const requirements = [
  [frame, 'const [comfortView, setComfortView] = useState(readAdminComfortView)', 'persistent display state'],
  [frame, "document.body.classList.toggle('admin-comfort-view', comfortView)", 'shared body mode'],
  [frame, "window.addEventListener('storage', syncDisplayPreference)", 'cross-tab preference updates'],
  [frame, 'onToggleComfortView={() => setComfortView((current) => !current)}', 'Help control integration'],
  [help, 'role="switch"', 'accessible switch semantics'],
  [help, 'aria-checked={comfortView}', 'truthful switch state'],
  [help, 'Use larger text and touch targets', 'plain-language display guidance'],
  [preferenceSource, "'pwc_admin_comfort_view'", 'stable local preference key'],
  [styles, 'phase-52-comfort-view-start', 'scoped Comfort View layer'],
  [styles, 'body.admin-app-mode.admin-comfort-view', 'optional global comfort mode'],
  [styles, '.pwc-comfort52-control', 'responsive display control'],
  [visualAudit, 'const stylesheetBudget = 568 * 1024', 'bounded stylesheet budget'],
  [packageSource, '"admin:qa:phase52"', 'focused Phase 52 QA command'],
  [docs, 'browser-local preference', 'privacy boundary documentation'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const values = new Map()
global.window = {
  localStorage: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  },
}

writeAdminComfortView(true)
if (values.get(ADMIN_COMFORT_STORAGE_KEY) !== 'true' || readAdminComfortView() !== true) {
  failures.push('Comfort View does not persist its enabled state')
}

writeAdminComfortView(false)
if (values.get(ADMIN_COMFORT_STORAGE_KEY) !== 'false' || readAdminComfortView() !== false) {
  failures.push('Comfort View does not persist its disabled state')
}

delete global.window

if (failures.length) {
  console.error('\nPhase 52 admin Comfort View audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 52 admin Comfort View audit passed (persistent browser-local preference, accessible switch, shared readability overrides, responsive controls, and preserved compact default).',
)
