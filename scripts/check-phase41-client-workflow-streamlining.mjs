import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const journeySource = read('src/pages/ClientPortalJourney.jsx')
const resourcesSource = read('src/pages/ClientPortalResources.jsx')
const sessionsSource = read('src/pages/ClientPortalSessions.jsx')
const messagesSource = read('src/pages/ClientPortalMessages.jsx')
const journeyStyles = read('src/pages/ClientPortalJourneyResources.css')
const workspaceStyles = read('src/pages/ClientPortalWorkspace.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [journeySource, '<details className="portal-progressive-section journey-history-disclosure">', 'progressive Journey history'],
  [journeySource, '<strong>Care history</strong>', 'plain-language Journey disclosure'],
  [journeySource, 'visibleNotes.map((record, index)', 'shared client reflections'],
  [journeySource, 'followUps.slice(1, 4).map', 'care follow-ups'],
  [journeySource, 'journeyStats.map((stat)', 'Journey totals'],
  [journeySource, 'serviceRecords.map((record)', 'complete service history'],
  [resourcesSource, '<details className="resource-filter-disclosure">', 'progressive Library filters'],
  [resourcesSource, '<span>Filter library</span>', 'clear Library filter label'],
  [resourcesSource, 'value={search}', 'Library search'],
  [resourcesSource, 'resourceTypes.map((type)', 'resource type filters'],
  [resourcesSource, 'filteredResources.map((resource, index)', 'filtered resource results'],
  [sessionsSource, "const [sessionView, setSessionView] = useState('manage')", 'single-task Session state'],
  [sessionsSource, 'className="portal-task-switcher"', 'Session task switcher'],
  [sessionsSource, "aria-pressed={sessionView === 'manage'}", 'accessible Session mode state'],
  [sessionsSource, '<details className="portal-progressive-section session-history-disclosure">', 'progressive Session history'],
  [messagesSource, "const [conversationScope, setConversationScope] = useState('open')", 'focused conversation state'],
  [messagesSource, 'const visibleConversations = conversationScope', 'open and closed conversation filtering'],
  [messagesSource, 'className="message-scope-switcher"', 'conversation status switcher'],
  [messagesSource, 'Private Inbox', 'private Inbox access'],
  [messagesSource, 'Encouragements', 'Encouragement access'],
  [journeyStyles, 'phase-41-journey-library-streamlining-start', 'Journey and Library responsive styles'],
  [workspaceStyles, 'phase-41-client-workflow-streamlining-start', 'Session and Message responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [journeySource, 'getClientPortalDashboard()', 'private Journey loading'],
  [journeySource, 'logoutClientPortal()', 'Journey secure sign out'],
  [resourcesSource, 'getClientPortalResources()', 'private Library loading'],
  [resourcesSource, "['http:', 'https:'].includes(url.protocol)", 'safe Library links'],
  [sessionsSource, 'createClientPortalBooking({', 'client booking requests'],
  [sessionsSource, 'createClientPortalBookingChangeRequest(changeTarget.id', 'booking change requests'],
  [sessionsSource, 'getPublicAvailabilitySlots(', 'live availability'],
  [sessionsSource, "openChange(booking, 'reschedule')", 'rescheduling'],
  [sessionsSource, "openChange(booking, 'cancel')", 'cancellation'],
  [messagesSource, 'createClientPortalInboxConversation(newMessage)', 'new private conversations'],
  [messagesSource, 'sendClientPortalInboxMessage(conversation.id, reply)', 'private replies'],
  [messagesSource, 'updateClientPortalInboxConversation(conversation.id, nextStatus)', 'conversation closing and reopening'],
  [messagesSource, 'markClientPortalMessageRead(messageId)', 'Encouragement read tracking'],
  [messagesSource, 'message.attachment_url', 'private message attachments'],
  [messagesSource, 'logoutClientPortal()', 'Message secure sign out'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 41 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-phase41-client-workflow-streamlining.mjs')) {
  failures.push('package.json does not run the Phase 41 client-workflow audit')
}

if (failures.length) {
  console.error('\nPhase 41 client workflow streamlining audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 41 client workflow streamlining audit passed (current-care Journey, searchable Library, focused Sessions, scoped Messages, preserved private actions, and responsive progressive disclosure).',
)
