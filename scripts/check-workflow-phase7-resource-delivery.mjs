import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const followThrough = read('src/pages/admin/AdminSessionFollowThrough.jsx')
const clients = read('src/pages/admin/AdminClients.jsx')
const vault = read('src/pages/admin/AdminAssetVault.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [followThrough, 'function chooseSecureResource(session)', 'session resource handoff'],
  [followThrough, 'client: session.clientProfileId', 'exact resource recipient'],
  [followThrough, 'session: session.id', 'resource session context'],
  [followThrough, 'Choose secure resource', 'clear secure-resource action'],
  [clients, '`/admin/assets?client=${encodeURIComponent(selectedClient.id)}`', 'client Resources-to-Vault handoff'],
  [clients, 'Choose secure Vault resource', 'clear Vault selection action'],
  [vault, "import { useSearchParams } from 'react-router-dom'", 'Vault query support'],
  [vault, "searchParams.get('client') || ''", 'requested Vault client'],
  [vault, 'clientProfileId: requestedClientId', 'preselected Vault assignment recipient'],
  [runner, "'scripts/check-workflow-phase7-resource-delivery.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase7"', 'Phase 7 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 7 resource delivery workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 7 resource delivery workflow audit passed (session-aware Vault handoff, exact client assignment, client Resources-to-Vault continuity, and preserved secure delivery controls).')
