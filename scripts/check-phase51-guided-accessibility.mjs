import { readFileSync } from 'node:fs'

import {
  adminPageGuidance,
  guidedAdminPaths,
} from '../src/components/admin/adminPageGuidance.js'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const frame = read('src/components/admin/AdminFrame.jsx')
const help = read('src/components/admin/AdminHelpCenter.jsx')
const guidance = read('src/components/admin/adminPageGuidance.js')
const styles = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')
const docs = read('docs/phase51-guided-admin-accessibility.md')
const failures = []

const requirements = [
  [frame, 'const [helpOpen, setHelpOpen] = useState(false)', 'shared Help state'],
  [frame, 'aria-keyshortcuts="?"', 'discoverable Help shortcut'],
  [frame, 'aria-keyshortcuts="Control+K Meta+K"', 'discoverable Quick Find shortcut'],
  [frame, '<AdminHelpCenter', 'shared page guide integration'],
  [help, 'role="dialog"', 'accessible page guide dialog'],
  [help, 'aria-modal="true"', 'modal semantics'],
  [help, 'previousFocusRef', 'focus restoration'],
  [help, "event.key !== 'Tab'", 'keyboard focus containment'],
  [help, "event.key === 'Escape'", 'keyboard dismissal'],
  [help, 'Open Quick Find', 'direct navigation handoff'],
  [styles, 'phase-51-guided-accessibility-start', 'scoped accessibility styles'],
  [styles, '@media (prefers-reduced-motion: reduce)', 'reduced-motion support'],
  [styles, '@media (forced-colors: active)', 'forced-color support'],
  [styles, "min-height: 44px", 'mobile touch target support'],
  [packageSource, '"admin:qa:phase51"', 'focused Phase 51 QA command'],
  [docs, 'contextual help', 'operator guidance documentation'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (guidedAdminPaths.length < 14) {
  failures.push(`only ${guidedAdminPaths.length} launch-critical routes have contextual guidance`)
}

for (const pathname of guidedAdminPaths) {
  const guide = adminPageGuidance(pathname)
  if (!Array.isArray(guide.steps) || guide.steps.length !== 3) {
    failures.push(`${pathname} does not have exactly three simple workflow steps`)
  }
  if (!guide.safety || guide.safety.length < 24) {
    failures.push(`${pathname} does not have a meaningful safety reminder`)
  }
}

const fallbackGuide = adminPageGuidance('/admin/audit-log')
if (fallbackGuide.steps.length !== 3 || !fallbackGuide.safety) {
  failures.push('unmapped admin routes do not receive the safe fallback guide')
}

if (failures.length) {
  console.error('\nPhase 51 guided admin accessibility audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Phase 51 guided admin accessibility audit passed (${guidedAdminPaths.length} contextual page guides, keyboard-safe dialog behavior, mobile touch targets, and accessible display preferences).`,
)
