import { readFileSync } from 'node:fs'

const lettersSource =
  readFileSync('src/pages/admin/AdminLetters.jsx', 'utf8')
  + readFileSync('src/components/admin/letters/LettersWorkspace.jsx', 'utf8')
const audienceSource = readFileSync('src/pages/admin/AdminAudience.jsx', 'utf8')
const sessionChangesSource = readFileSync('src/pages/admin/AdminSessionChangeRequests.jsx', 'utf8')
const stylesSource = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const requiredTokens = [
  [lettersSource, "['delivery', 'Delivery']", 'Letters delivery mode'],
  [lettersSource, "['results', 'Results']", 'Letters results mode'],
  [lettersSource, "const [libraryMode, setLibraryMode] = useState('drafts')", 'Letters draft-first library'],
  [lettersSource, 'aria-label="Letter library view"', 'Letters library switch'],
  [lettersSource, 'aria-label="Broadcast delivery view"', 'Letters delivery switch'],
  [lettersSource, 'Manage audience →', 'Letters audience handoff'],
  [audienceSource, "const [workspaceMode, setWorkspaceMode] = useState('directory')", 'Audience directory-first mode'],
  [audienceSource, "['add', 'Add people']", 'Audience focused add mode'],
  [audienceSource, "['imports', 'Import history']", 'Audience import history mode'],
  [audienceSource, 'aria-label="Audience record sections"', 'Audience focused record tabs'],
  [audienceSource, "['consent', 'Consent & status']", 'Audience consent workspace'],
  [sessionChangesSource, 'session-change-admin__workbench', 'Session Change workbench'],
  [sessionChangesSource, 'session-change-admin__queue', 'Session Change compact queue'],
  [sessionChangesSource, 'session-change-card--focused', 'Session Change focused review'],
  [stylesSource, 'phase-35-communication-streamlining-start', 'Phase 35 responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedActions = [
  [lettersSource, 'createLetter(', 'create a letter'],
  [lettersSource, 'duplicateLetter(', 'duplicate a letter'],
  [lettersSource, 'saveLetter(', 'save a letter'],
  [lettersSource, 'prepareLetterBroadcast(', 'prepare a broadcast'],
  [lettersSource, 'sendLetterTest(', 'send a test letter'],
  [lettersSource, 'scheduleLetterBroadcast(', 'schedule a broadcast'],
  [lettersSource, 'sendLetterBroadcastNow(', 'send a broadcast now'],
  [lettersSource, 'cancelLetterBroadcast(', 'cancel a scheduled broadcast'],
  [lettersSource, 'processDueLetterBroadcasts(', 'process due broadcasts'],
  [audienceSource, 'createNewsletterAudienceSubscriber(', 'add one audience member'],
  [audienceSource, 'createNewsletterAudienceBulk(', 'add multiple audience members'],
  [audienceSource, 'importNewsletterAudienceCsv(', 'import audience CSV data'],
  [audienceSource, 'addClientToNewsletterAudience(', 'add a consenting client'],
  [audienceSource, 'bulkUpdateNewsletterAudienceTags', 'bulk update audience tags'],
  [audienceSource, 'bulkUpdateNewsletterAudienceSegments', 'bulk update audience segments'],
  [audienceSource, 'updateNewsletterAudienceStatus(', 'protect audience delivery status'],
  [sessionChangesSource, 'reviewAdminSessionChangeRequest(', 'review a session change request'],
]

for (const [source, token, action] of preservedActions) {
  if (!source.includes(token)) failures.push(`Phase 35 no longer exposes the action to ${action}`)
}

if (!packageSource.includes('node scripts/check-admin-phase35-communication-workflows.mjs')) {
  failures.push('package.json does not run the Phase 35 Communication workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 35 Communication workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 35 Communication workflow audit passed (three-mode Letters, directory-first Audience, focused consent records, compact Session Change review, and preserved backend actions).',
)
