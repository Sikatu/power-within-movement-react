import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const founderSource = read('src/pages/admin/AdminFoundersView.jsx')
const availabilitySource = read('src/pages/admin/AdminFounderAvailability.jsx')
const calendarSource = read('src/pages/admin/AdminFounderCalendar.jsx')
const recorderSource = read('src/components/admin/FounderVoiceRecorder.jsx')
const clocksSource = read('src/components/admin/FounderLiveClocks.jsx')
const stylesSource = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [founderSource, 'const FOUNDER_VIEWS = [', 'focused Founder views'],
  [founderSource, "{ id: 'today', label: 'Today'", 'Today-first Founder view'],
  [founderSource, "{ id: 'protect', label: 'Protect my time'", 'time-protection view'],
  [founderSource, "{ id: 'voice', label: 'Voice notes'", 'private voice view'],
  [founderSource, "{ id: 'clocks', label: 'World clocks'", 'world-clock view'],
  [founderSource, 'aria-label="Founder workspace"', 'accessible Founder task switch'],
  [founderSource, "activeView === 'today'", 'Today-only daily summary'],
  [founderSource, "activeView === 'voice' && founderTools", 'focused voice tools'],
  [founderSource, "activeView === 'clocks' && founderTools", 'focused clock tools'],
  [availabilitySource, "searchParams.get('view') === 'date'", 'availability task routing'],
  [availabilitySource, 'aria-label="Availability tasks"', 'accessible availability task switch'],
  [availabilitySource, 'aria-selected={availabilityView === \'week\'}', 'usual-week selection state'],
  [availabilitySource, 'aria-selected={availabilityView === \'date\'}', 'one-date selection state'],
  [availabilitySource, "setSearchParams({ view: 'date', date: dateValue })", 'special-date deep linking'],
  [availabilitySource, "hidden={availabilityView !== 'week'}", 'focused usual-week editor'],
  [availabilitySource, "hidden={availabilityView !== 'date'}", 'focused one-date editor'],
  [stylesSource, 'phase-37-founder-workflow-streamlining-start', 'Phase 37 responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedActions = [
  [founderSource, 'getAdminFoundersViewOverview(', 'load the Founder daily overview'],
  [founderSource, 'getFounderCommandCenter(', 'load private Founder tools'],
  [founderSource, 'updateAdminFounderDateAvailability(', 'protect a date'],
  [founderSource, 'updateAdminFounderAvailabilityException(', 'reopen a protected date'],
  [availabilitySource, 'getAdminFounderAvailability(', 'load availability'],
  [availabilitySource, 'updateAdminFounderWeeklyAvailability(', 'save the usual week'],
  [availabilitySource, 'updateAdminFounderDateAvailability(', 'save a one-date change'],
  [calendarSource, 'getAdminFounderCalendar(', 'load the Founder calendar'],
  [calendarSource, 'updateAdminFounderDateAvailability(', 'protect or reopen from the calendar'],
  [clocksSource, 'saveFounderToolPreferences(', 'save clock preferences'],
  [recorderSource, 'uploadFounderRecording(', 'save a private recording'],
  [recorderSource, 'requestFounderTranscription(', 'request transcription'],
  [recorderSource, 'reuseFounderTranscriptInLetter(', 'reuse a transcript in Letters'],
  [recorderSource, 'assignFounderRecording(', 'share a recording explicitly'],
  [recorderSource, 'unassignFounderRecording(', 'remove recording access'],
  [recorderSource, 'archiveFounderRecording(', 'archive a recording'],
  [recorderSource, 'restoreFounderRecording(', 'restore a recording'],
  [recorderSource, 'permanentlyDeleteFounderRecording(', 'permanently delete a recording'],
]

for (const [source, token, action] of preservedActions) {
  if (!source.includes(token)) failures.push(`Phase 37 no longer exposes the action to ${action}`)
}

if (!packageSource.includes('node scripts/check-admin-phase37-founder-workflows.mjs')) {
  failures.push('package.json does not run the Phase 37 Founder workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 37 Founder workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 37 Founder workflow audit passed (Today-first home, four focused Founder tasks, two focused availability tasks, deep links, and preserved private actions).',
)
