import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const momentum = read('src/pages/admin/AdminClientMomentum.jsx')
const coverage = read('src/pages/admin/AdminClientCoverage.jsx')
const inbox = read('src/pages/admin/AdminInbox.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [momentum, "searchParams.get('client') || ''", 'requested Momentum client'],
  [momentum, 'useState(requestedClientName)', 'visible Momentum client filter'],
  [momentum, 'client.id === requestedClientId', 'exact Momentum client restoration'],
  [momentum, '`/admin/attention?${clientParams(client)}`', 'client-aware Momentum attention handoff'],
  [momentum, '`/admin/scheduler?${clientParams(selectedClient)}`', 'client-aware Momentum session handoff'],
  [coverage, "searchParams.get('client') || ''", 'requested Coverage client'],
  [coverage, 'client.id === requestedClientId', 'exact Coverage client restoration'],
  [coverage, '`/admin/attention?${clientParams(selectedClient)}`', 'client-aware Coverage attention handoff'],
  [coverage, '`/admin/scheduler?${clientParams(selectedClient)}`', 'client-aware Coverage session handoff'],
  [coverage, "client.openConversations ? {} : { compose: 'new' }", 'truthful Coverage Inbox choice'],
  [inbox, 'requestedClientId && !requestedClientConversation', 'missing-conversation composer fallback'],
  [runner, "'scripts/check-workflow-phase10-client-care-context.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase10"', 'Phase 10 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 10 client care context audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 10 client care context audit passed (exact Momentum and Coverage restoration, client-aware Sessions and Attention handoffs, existing conversation reuse, and preselected secure composer fallback).')
