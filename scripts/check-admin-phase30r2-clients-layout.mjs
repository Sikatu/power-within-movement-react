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

requireRule('.client-circle-metrics-v2', [
  'display: grid',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
])
requireRule('.client-circle-metric-v2', [
  'display: grid',
  'align-content: center',
  'gap: 6px',
])
requireRule('.client-circle-workspace-v2', ['display: grid', 'gap: 18px'])
requireRule('.client-records-card-v2', [
  'height: auto',
  'max-height: none',
  'overflow: hidden',
])
requireRule('.client-records-card-v2 > .client-card-header-v2', [
  'display: flex',
  'justify-content: space-between',
  'border-bottom: 1px solid var(--admin-border)',
])
requireRule('.client-circle-filter-bar-v2', [
  'display: grid',
  'align-items: end',
  'grid-template-columns: minmax(240px, 1.5fr) repeat(3, minmax(145px, 0.75fr)) auto',
])
requireRule('.client-quick-filter-strip-v2', [
  'display: flex',
  'align-items: center',
  'overflow-x: auto',
])
requireRule('.client-quick-filter-chip-v2', [
  'display: inline-flex',
  'align-items: center',
  'gap: 5px',
])
requireRule('.client-quick-filter-chip-v2 strong', [
  'display: inline-grid',
  'place-items: center',
  'border-radius: 999px',
])
requireRule('.client-record-table-wrap-v2', [
  'min-height: 280px',
  'max-height: min(62vh, 720px)',
  'overflow: auto',
])
requireRule('.client-record-table-v2', [
  'width: 100%',
  'border-collapse: collapse',
  'table-layout: fixed',
])
requireRule('.client-record-table-v2 thead th', [
  'position: sticky',
  'top: 0',
  'z-index: 2',
])
requireRule('.client-circle-workspace-v2 > .client-detail-card-v2', [
  'position: relative',
  'padding: clamp(22px, 3vw, 32px)',
  'box-shadow: var(--admin-shadow)',
])

for (const token of [
  'client-circle-page-v2',
  'client-circle-metrics-v2',
  'client-records-card-v2',
  'client-circle-filter-bar-v2',
  'client-quick-filter-strip-v2',
  'client-record-table-wrap-v2',
  'aria-label="Quick client filters"',
]) {
  if (!clients.includes(token)) failures.push(`AdminClients.jsx is missing layout hook: ${token}`)
}

for (const token of ['@media (max-width: 860px)', '@media (max-width: 620px)']) {
  if (!css.includes(token)) failures.push(`Clients layout is missing responsive safeguard: ${token}`)
}

for (const token of [
  'admin:qa:phase30r2',
  'node scripts/check-admin-phase30r2-clients-layout.mjs',
]) {
  if (!packageSource.includes(token)) failures.push(`package.json is missing Phase 30R.2 QA hook: ${token}`)
}

if (failures.length) {
  console.error('\nAdmin Phase 30R.2 Clients layout audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin Phase 30R.2 Clients layout audit passed (metric grid, compact filters, stable table viewport, responsive records header, and separated care panel).')
