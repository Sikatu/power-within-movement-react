import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const sources = {
  migration: read('server/scripts/ensure-founder-command-center.cjs'),
  transcription: read('server/src/services/founderTranscription.service.js'),
  routes: read('server/src/routes/founderTools.routes.js'),
  assetRoutes: read('server/src/routes/assetVault.routes.js'),
  appServer: read('server/src/app.js'),
  server: read('server/src/server.js'),
  env: read('server/src/config/env.js'),
  envExample: read('server/.env.example'),
  page: read('src/pages/admin/AdminFoundersView.jsx'),
  clocks: read('src/components/admin/FounderLiveClocks.jsx'),
  recorder: read('src/components/admin/FounderVoiceRecorder.jsx'),
  letters: read('src/pages/admin/AdminLetters.jsx'),
  api: read('src/lib/nativeApi.js'),
  styles: read('src/pages/admin/AdminFreshUI.css'),
  tests: read('server/tests/founder-command-center.test.cjs'),
  package: read('package.json'),
}

const requirements = {
  migration: [
    'founder_tool_preferences',
    'founder_recordings',
    'founder_transcription_jobs',
    'founder_recording_events',
    "DEFAULT 'America/Chicago'",
    'recording_retention_days',
    "'permanently_deleted'",
    "'reused_in_letter'",
  ],
  transcription: [
    'DEFAULT_COMPARISON_TIMEZONES',
    "'America/Chicago'",
    "'Asia/Manila'",
    "'Europe/London'",
    'isValidTimeZone',
    'getTranscriptionConfiguration',
    'readObject',
    'new FormData()',
    'TRANSCRIPTION_NOT_CONFIGURED',
    'pg_try_advisory_lock',
    'startFounderTranscriptionDispatcher',
  ],
  routes: [
    "req.user?.role === 'owner'",
    "req.user?.role === 'developer'",
    "router.get('/overview'",
    "router.patch('/preferences'",
    "router.post('/recordings/upload'",
    "visibility, folder_id, tags",
    "'private'",
    "'founder_recording'",
    "router.post('/recordings/:recordingId/transcription'",
    "router.post('/recordings/:recordingId/access'",
    "router.post('/recordings/:recordingId/assignments'",
    "router.delete('/recordings/:recordingId/assignments/:assignmentId'",
    "router.post('/recordings/:recordingId/reuse-letter'",
    "router.post('/recordings/:recordingId/archive'",
    "router.post('/recordings/:recordingId/restore'",
    "router.delete('/recordings/:recordingId'",
    'confirmation !== recording.title',
    "'founder_recording_permanently_deleted'",
    'schedulingTimezoneChanged: false',
  ],
  assetRoutes: [
    "context_type = 'founder_recording'",
    'Founder recordings require the owner or developer account.',
    "req.user?.role === 'admin'",
    'protected_relationship.asset_id = asset_totals.id',
    'SELECT DISTINCT unnest(tags) AS tag',
  ],
  appServer: ["app.use('/api/admin/founder-tools'"],
  server: ['startFounderTranscriptionDispatcher(pool)'],
  env: ['founderTranscriptionProvider', 'founderTranscriptionApiKey', 'founderTranscriptionTimeoutMs'],
  envExample: ['FOUNDER_TRANSCRIPTION_PROVIDER=disabled', 'Never expose', 'FOUNDER_TRANSCRIPTION_API_KEY='],
  page: ['FounderLiveClocks', 'FounderVoiceRecorder', 'getFounderCommandCenter', '1_000', "'America/Chicago'"],
  clocks: [
    'Founder live clock',
    'My primary clock',
    'Scheduling timezone',
    'never moves booked sessions',
    'Eastern',
    'Central',
    'Mountain',
    'Pacific',
    'Philippines',
    'UK',
    'Custom timezone',
    "formatZone(value, timeZone, 'short')",
    "formatZone(value, timeZone, 'long')",
  ],
  recorder: [
    'MediaRecorder',
    'getUserMedia',
    '.pause()',
    '.resume()',
    '.stop()',
    'AudioContext',
    'Listen before saving',
    'Keep private',
    'Save to Asset Vault',
    'Request transcription',
    'Save transcript',
    'Copy',
    'Reuse in Letters',
    'Explicitly share recording',
    'Private recording retention',
    'Permanently delete',
    'permission to record',
  ],
  letters: ['useSearchParams', "searchParams.get('letter')", 'openLetter(requestedLetterId)'],
  api: ['/api/admin/founder-tools', 'uploadFounderRecording', 'getFounderRecordingAccess', 'reuseFounderTranscriptInLetter'],
  styles: ['.pwc-founder29-clocks', '.pwc-founder29-recorder-grid', '.pwc-founder29-detail', 'phase-29-founder-command-center-end'],
  tests: ['Chicago with the requested comparison zones', 'never exposes server secrets', 'requires both a server endpoint and credential'],
  package: ['check-admin-phase29-founder.mjs', 'admin:qa:phase29'],
}

const failures = []
for (const [sourceName, tokens] of Object.entries(requirements)) {
  for (const token of tokens) {
    if (!sources[sourceName].includes(token)) failures.push(`${sourceName} is missing: ${token}`)
  }
}

if (/VITE_(?:FOUNDER_)?TRANSCRIPTION_(?:API_KEY|KEY|SECRET)/.test(Object.values(sources).join('\n'))) {
  failures.push('a transcription provider secret is exposed through a Vite browser variable')
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(`${sources.page}\n${sources.clocks}\n${sources.recorder}`)) {
  failures.push('Founder Command Center uses a native browser dialog')
}

if (failures.length) {
  console.error('\nAdmin Phase 29 Founder Command Center audit failed:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Admin Phase 29 Founder Command Center audit passed (${Object.values(requirements).flat().length} protected capabilities).`)
