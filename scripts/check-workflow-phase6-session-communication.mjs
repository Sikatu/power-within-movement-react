import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const followThrough = read('src/pages/admin/AdminSessionFollowThrough.jsx')
const inbox = read('src/pages/admin/AdminInbox.jsx')
const messages = read('src/pages/admin/AdminEncouragements.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [followThrough, 'function openPrivateMessage(session)', 'private-message handoff'],
  [followThrough, "compose: 'new'", 'Inbox composer deep link'],
  [followThrough, 'client: session.clientProfileId', 'exact client handoff'],
  [followThrough, 'session: session.id', 'session context handoff'],
  [followThrough, 'Send private message', 'clear private-message action'],
  [followThrough, 'function openPortalMessage(session)', 'portal-message handoff'],
  [followThrough, 'Share portal encouragement', 'clear portal-message action'],
  [inbox, "searchParams.get('compose') === 'new'", 'requested Inbox composer state'],
  [inbox, "searchParams.get('client') || ''", 'requested Inbox client'],
  [inbox, 'clientProfileId: requestedClientId', 'preselected Inbox recipient'],
  [inbox, 'subject: requestedSubject.slice(0, 180)', 'bounded session follow-up subject'],
  [messages, "searchParams.get('client') || ''", 'requested portal-message client'],
  [messages, "visibility: requestedClientId ? 'single_client' : 'all_members'", 'client-scoped portal visibility'],
  [messages, 'clientProfileId: requestedClientId', 'preselected portal recipient'],
  [runner, "'scripts/check-workflow-phase6-session-communication.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase6"', 'Phase 6 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 6 session communication workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 6 session communication workflow audit passed (exact client recipient handoffs, session-aware private follow-up, portal encouragement scoping, and preserved communication channels).')
