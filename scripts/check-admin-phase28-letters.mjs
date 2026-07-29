import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const sources = {
  migration: read('server/scripts/ensure-letter-builder.cjs'),
  builderService: read('server/src/services/letterBuilder.service.js'),
  broadcastService: read('server/src/services/letterBroadcast.service.js'),
  adminRoutes: read('server/src/routes/letterBuilder.routes.js'),
  publicRoutes: read('server/src/routes/letterPublic.routes.js'),
  appServer: read('server/src/app.js'),
  page: read('src/pages/admin/AdminLetters.jsx')
    + read('src/components/admin/letters/LettersWorkspace.jsx'),
  canvas: read('src/components/admin/LetterCanvas.jsx'),
  settings: read('src/components/admin/LetterBlockSettings.jsx'),
  api: read('src/lib/nativeApi.js'),
  app: read('src/App.jsx'),
  nav: read('src/components/admin/AdminFrame.jsx')
    + read('src/components/admin/adminNavigation.js'),
  tests: read('server/tests/letter-builder.test.cjs'),
  package: read('package.json'),
}

const requirements = {
  migration: [
    'letter_templates',
    'letter_documents',
    'letter_versions',
    'letter_broadcasts',
    'letter_broadcast_recipients',
    'letter_tracking_links',
    'letter_events',
    'letter_test_sends',
    'subject_snapshot',
    'design_snapshot',
    "'unsubscribed'",
  ],
  builderService: [
    'LETTER_BLOCK_TYPES',
    'normalizeDesign',
    'renderLetter',
    'collectTrackedLinks',
    'encodeSignedToken',
    'decodeSignedToken',
    'verifyResendWebhook',
    "block.type === 'unsubscribe'",
  ],
  broadcastService: [
    "s.status = 'subscribed'",
    "s.consent_status = 'granted'",
    'newsletter_suppressions',
    'snapshotBroadcastRecipients',
    'subject_snapshot',
    'List-Unsubscribe-Post',
    'sent_at IS NOT NULL',
    'LETTER_PROVIDER_NOT_CONFIGURED',
    'processDueLetterBroadcasts',
    'letterSendConcurrency',
  ],
  adminRoutes: [
    "router.get('/overview'",
    "router.post('/letters'",
    "router.patch('/letters/:letterId'",
    'LETTER_REVISION_CONFLICT',
    "router.post('/letters/:letterId/test-send'",
    "router.post('/letters/:letterId/broadcasts/prepare'",
    "router.post('/broadcasts/:broadcastId/schedule'",
    "router.post('/broadcasts/:broadcastId/send-now'",
    "router.get('/broadcasts/:broadcastId/export.csv'",
    'design_snapshot',
  ],
  publicRoutes: [
    "router.get('/unsubscribe/:token'",
    "router.post('/unsubscribe/:token'",
    "router.get('/open/:token.gif'",
    "router.get('/click/:token'",
    "router.get('/assets/:token'",
    "router.post('/webhooks/resend'",
    'duplicate: true',
    'createSuppression',
  ],
  appServer: ['req.rawBody = Buffer.from(buffer)', "app.use('/api/admin/letters'", "app.use('/api/public/letters'"],
  page: [
    'Letters & Broadcasts',
    'Choose Recipients',
    'Draft Recovery',
    'Save as reusable template',
    'Schedule or Send',
    'Per-link activity',
    'Export CSV',
    'getLetterBroadcastExportUrl',
  ],
  canvas: ['text/pwc-letter-block', 'previewMode', 'is-required'],
  settings: ['AssetVaultPicker', 'Personalization fields', 'cannot be deleted or duplicated'],
  api: ['/api/admin/letters', 'prepareLetterBroadcast', 'sendLetterBroadcastNow'],
  app: ['/admin/letters', 'AdminLetters'],
  nav: ['/admin/letters', 'Letters & Broadcasts'],
  tests: ['one final unsubscribe block', 'signed letter tokens', 'audience modes discard stale filters'],
  package: ['check-admin-phase28-letters.mjs', 'admin:qa:phase28'],
}

const failures = []
for (const [sourceName, tokens] of Object.entries(requirements)) {
  for (const token of tokens) {
    if (!sources[sourceName].includes(token)) failures.push(`${sourceName} is missing: ${token}`)
  }
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(sources.page)) {
  failures.push('Letters workspace uses a native browser dialog')
}

if (!sources.builderService.includes("blocks.filter((block) => block.type !== 'unsubscribe'), unsubscribe")) {
  failures.push('mandatory unsubscribe block is not normalized to the end of every design')
}

if (failures.length) {
  console.error('\nAdmin Phase 28 Letters & Broadcasts audit failed:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Admin Phase 28 Letters & Broadcasts audit passed (${Object.values(requirements).flat().length} protected capabilities).`)
