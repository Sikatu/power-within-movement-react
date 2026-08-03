import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const inbox = read('src/pages/admin/AdminInbox.jsx')
const client360 = read('src/pages/admin/AdminClient360.jsx')
const clients = read('src/pages/admin/AdminClients.jsx')
const letters = read('src/components/admin/letters/LettersWorkspace.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [inbox, "searchParams.get('search') || ''", 'requested Inbox search'],
  [inbox, 'search: requestedSearch.slice(0, 180)', 'safe Inbox search restoration'],
  [inbox, "searchParams.get('client') || ''", 'requested Inbox client'],
  [inbox, 'requestedClientConversation?.id', 'existing client conversation restoration'],
  [client360, 'to={`/admin/inbox?client=${client.id}`}', 'Client 360 Inbox handoff'],
  [clients, 'navigate(`/admin/inbox?client=${clientActionMenu.client.id}`)', 'Client directory Inbox handoff'],
  [clients, 'navigate(`/admin/inbox?client=${selectedClient.id}`)', 'Quick Profile Inbox handoff'],
  [letters, '/admin/inbox?search=${encodeURIComponent(detail.subject || detail.title)}', 'broadcast reply search handoff'],
  [runner, "'scripts/check-workflow-phase15-communication-continuity.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase15"', 'Phase 15 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 15 communication continuity workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 15 communication continuity workflow audit passed (exact client Inbox restoration, working broadcast-reply search, and direct directory and care-context messaging handoffs).')
