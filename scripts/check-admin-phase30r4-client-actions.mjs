import { readFileSync } from 'node:fs'

const css = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const clients = readFileSync('src/pages/admin/AdminClients.jsx', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const compactCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const failures = []

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function requireRule(selector, declarations) {
  const rulePattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'g')
  const blocks = [...compactCss.matchAll(rulePattern)].map((match) => match[1])
  const hasCompleteRule = blocks.some((block) =>
    declarations.every((declaration) => block.includes(declaration)),
  )

  if (!hasCompleteRule) {
    failures.push(`${selector} is missing: ${declarations.join(', ')}`)
  }
}

requireRule('.client-action-menu-button-v1', [
  'display: inline-grid',
  'width: 36px',
  'cursor: pointer',
])
requireRule('.client-action-menu-panel-v1', [
  'position: fixed',
  'z-index: 120',
  'display: grid',
  'width: 208px',
])
requireRule('.client-action-menu-panel-v1 > button', [
  'display: grid',
  'grid-template-columns: 28px minmax(0, 1fr)',
  'min-height: 42px',
])
requireRule('.client-drawer-backdrop-v3', [
  'position: fixed',
  'inset: 0',
  'z-index: 64',
])
requireRule('.client-circle-detail-v2', [
  'position: fixed',
  'width: min(560px, calc(100vw - 32px))',
  'overflow: hidden',
  'z-index: 70',
])
requireRule('.client-form-drawer-v2', [
  'position: fixed',
  'overflow-y: auto',
  'overscroll-behavior: contain',
])
requireRule('.client-detail-card-v2', [
  'height: 100%',
  'overflow-y: auto',
  'scrollbar-gutter: stable',
])
requireRule('.client-detail-header-actions-v2', [
  'display: flex',
  'flex-wrap: nowrap',
  'gap: 6px',
])
requireRule('.client-detail-jump-nav-v2', [
  'position: sticky',
  'display: flex',
  'overflow-x: auto',
])

for (const token of [
  "import { createPortal } from 'react-dom'",
  'clientActionMenu',
  'getBoundingClientRect()',
  'role="menu"',
  'role="menuitem"',
  'aria-haspopup="menu"',
  'handleClientActionMenuKeyDown',
  'Quick profile',
  'Client 360',
  'Edit details',
  'client-drawer-backdrop-v3',
  'Close quick profile',
]) {
  if (!clients.includes(token)) {
    failures.push(`AdminClients.jsx is missing accessible action behavior: ${token}`)
  }
}

if (clients.includes('<details className="client-action-menu-v1"')) {
  failures.push('AdminClients.jsx still uses the clipped table details menu.')
}

for (const token of [
  'admin:qa:phase30r4',
  'node scripts/check-admin-phase30r4-client-actions.mjs',
]) {
  if (!packageSource.includes(token)) {
    failures.push(`package.json is missing Phase 30R.4 QA hook: ${token}`)
  }
}

if (failures.length) {
  console.error('\nAdmin Phase 30R.4 client actions audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin Phase 30R.4 client actions audit passed (compact portal menu, keyboard controls, fixed drawers, backdrop dismissal, and responsive profile layout).')
