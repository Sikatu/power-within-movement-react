import { readFileSync } from 'node:fs'

const clients = readFileSync('src/pages/admin/AdminClients.jsx', 'utf8')
const client360 = readFileSync('src/pages/admin/AdminClient360.jsx', 'utf8')
const failures = []

for (const token of [
  "import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'",
  "const activeClientIdRef = useRef('')",
  'activeClientIdRef.current !== String(client.id)',
  'activeClientIdRef.current = String(client.id)',
  'Archive client',
  'Archive record',
  'Revoke invitation',
  '!filteredClients.some((client) => client.id === selectedClient.id)',
]) {
  if (!clients.includes(token)) {
    failures.push(`Client directory workflow safeguard is missing: ${token}`)
  }
}

if (/filteredClients\.length\s*>\s*0\s*&&\s*!filteredClients\.some/.test(clients)) {
  failures.push('The hidden-client warning still disappears when filters return zero rows.')
}

for (const token of [
  "import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'",
  "if (status === 'cancelled')",
  'Cancel this care action?',
  'Cancel action',
]) {
  if (!client360.includes(token)) {
    failures.push(`Client 360 workflow safeguard is missing: ${token}`)
  }
}

if (failures.length) {
  console.error('\nPhase 3 client-management workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 3 client-management workflow audit passed (selection-safe loading, truthful filtered context, and confirmed archive, revoke, and cancellation actions).')
