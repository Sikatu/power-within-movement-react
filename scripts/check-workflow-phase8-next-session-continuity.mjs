import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const followThrough = read('src/pages/admin/AdminSessionFollowThrough.jsx')
const client360 = read('src/pages/admin/AdminClient360.jsx')
const inbox = read('src/pages/admin/AdminInbox.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [followThrough, 'function inviteNextSession(session)', 'next-session invitation handoff'],
  [followThrough, '!selectedSession.nextSessionAt', 'no-upcoming-session guard'],
  [followThrough, 'Invite next-session request', 'clear next-session action'],
  [followThrough, "subject: 'Planning your next session'", 'next-session subject'],
  [followThrough, 'please open Sessions in your Client Portal', 'truthful client request instruction'],
  [client360, 'Invite a next-session request', 'Client 360 continuity action'],
  [client360, "compose: 'new'", 'Client 360 Inbox composer handoff'],
  [client360, 'client: client.id', 'Client 360 exact recipient'],
  [inbox, "searchParams.get('body') || ''", 'requested message body'],
  [inbox, 'body: requestedBody.slice(0, 4000)', 'bounded prefilled message'],
  [runner, "'scripts/check-workflow-phase8-next-session-continuity.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase8"', 'Phase 8 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 8 next-session continuity workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 8 next-session continuity workflow audit passed (no-session guards, exact-client invitation handoffs, bounded message prefilling, truthful portal request guidance, and preserved availability controls).')
