const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const {
  LETTER_BLOCK_TYPES,
  collectTrackedLinks,
  createLetterBlock,
  decodeSignedToken,
  encodeSignedToken,
  normalizeDesign,
  renderLetter,
  safeUrl,
  validateLetter,
  verifyResendWebhook,
} = require('../src/services/letterBuilder.service')
const {
  audienceFilterSql,
  buildBroadcastPreflight,
  normalizeAudienceFilter,
} = require('../src/services/letterBroadcast.service')

test('letter builder exposes every Phase 28 content block', () => {
  assert.deepEqual([...LETTER_BLOCK_TYPES], [
    'heading', 'text', 'image', 'button', 'divider', 'spacer', 'two_column',
    'quote', 'signature', 'social_links', 'video_preview', 'resource',
    'greeting', 'footer', 'unsubscribe',
  ])
  assert.equal(createLetterBlock('unknown').type, 'text')
})

test('design normalization enforces one final unsubscribe block', () => {
  const normalized = normalizeDesign({
    blocks: [
      createLetterBlock('unsubscribe', { id: 'first-unsubscribe' }),
      createLetterBlock('text', { id: 'message' }),
      createLetterBlock('unsubscribe', { id: 'final-unsubscribe' }),
      createLetterBlock('heading', { id: 'heading-after-unsubscribe' }),
    ],
  })
  assert.equal(normalized.blocks.filter((block) => block.type === 'unsubscribe').length, 1)
  assert.equal(normalized.blocks.at(-1).type, 'unsubscribe')
  assert.equal(normalized.blocks.at(-1).id, 'final-unsubscribe')

  const inserted = normalizeDesign({ blocks: [createLetterBlock('text')] })
  assert.equal(inserted.blocks.at(-1).type, 'unsubscribe')
})

test('design normalization rejects CSS injection and clamps visual settings', () => {
  const normalized = normalizeDesign({
    settings: { backgroundColor: 'rgb(0; background:url(javascript:alert(1)))', contentWidth: 5000 },
    blocks: [{ id: 'space', type: 'spacer', settings: { height: 5000, backgroundColor: '#abc' } }],
  })
  assert.equal(normalized.settings.backgroundColor, '#f6eee9')
  assert.equal(normalized.settings.contentWidth, 760)
  assert.equal(normalized.blocks[0].settings.height, 160)
  assert.equal(normalized.blocks[0].settings.backgroundColor, '#abc')
})

test('letter validation reports missing subjects and unsafe destinations without removing compliance', () => {
  const design = normalizeDesign({ blocks: [createLetterBlock('button', { content: { text: 'Unsafe', url: 'javascript:alert(1)' } })] })
  const validation = validateLetter({ title: 'July reflection', subject: '', design })
  assert.equal(validation.ok, false)
  assert.match(validation.errors.join(' '), /subject is required/i)
  assert.match(validation.warnings.join(' '), /safe destination URL/i)
  assert.equal(validation.design.blocks.at(-1).type, 'unsubscribe')
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl('https://powerwithinmovement.com/path'), 'https://powerwithinmovement.com/path')
})

test('email rendering escapes content, personalizes fields, and includes protected delivery links', () => {
  const design = normalizeDesign({
    blocks: [
      createLetterBlock('greeting', { id: 'hello', content: { text: 'Hello {{firstName}},' } }),
      createLetterBlock('text', { id: 'body', content: { text: '<script>bad()</script>\nYou are safe here.' } }),
      createLetterBlock('button', { id: 'continue', content: { text: 'Continue', url: 'https://example.com/original' } }),
      createLetterBlock('unsubscribe', { id: 'leave' }),
    ],
  })
  const rendered = renderLetter({
    design,
    subject: 'A note for {{firstName}}',
    previewText: 'Private preview',
    variables: { firstName: 'Ari' },
    unsubscribeUrl: 'https://api.example.com/unsubscribe/signed',
    openPixelUrl: 'https://api.example.com/open/signed.gif',
    trackingUrls: { continue: 'https://api.example.com/click/signed' },
  })
  assert.match(rendered.html, /Hello Ari/)
  assert.doesNotMatch(rendered.html, /<script>bad/)
  assert.match(rendered.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
  assert.match(rendered.html, /https:\/\/api\.example\.com\/click\/signed/)
  assert.match(rendered.html, /https:\/\/api\.example\.com\/unsubscribe\/signed/)
  assert.match(rendered.html, /https:\/\/api\.example\.com\/open\/signed\.gif/)
  assert.match(rendered.text, /Hello Ari/)
})

test('tracked links include only safe button and video destinations', () => {
  const links = collectTrackedLinks({
    blocks: [
      createLetterBlock('button', { id: 'safe', content: { text: 'Safe', url: 'https://example.com' } }),
      createLetterBlock('video_preview', { id: 'unsafe', content: { title: 'Unsafe', url: 'data:text/html,bad' } }),
      createLetterBlock('social_links', { id: 'social', content: { website: 'https://example.org' } }),
    ],
  })
  assert.equal(links.length, 1)
  assert.equal(links[0].blockId, 'safe')
  assert.equal(links[0].destinationUrl, 'https://example.com/')
})

test('signed letter tokens enforce signature, purpose, and expiry', () => {
  const secret = 'phase-28-token-test-secret'
  const now = Date.parse('2026-07-16T00:00:00.000Z')
  const token = encodeSignedToken('click', { recipientId: 'recipient-1' }, secret, 60, now)
  assert.equal(decodeSignedToken(token, { type: 'click', secret, now }).recipientId, 'recipient-1')
  assert.throws(() => decodeSignedToken(token, { type: 'asset', secret, now }), /cannot be used/i)
  assert.throws(() => decodeSignedToken(`${token}tampered`, { type: 'click', secret, now }), /invalid/i)
  assert.throws(() => decodeSignedToken(token, { type: 'click', secret, now: now + 61_000 }), /expired/i)
})

test('Resend webhook verification accepts current Svix signatures and rejects stale payloads', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'message-1' } })
  const webhookId = 'msg_phase28'
  const timestamp = '1784160000'
  const now = Number(timestamp) * 1000
  const key = Buffer.from('phase-28-webhook-key')
  const secret = `whsec_${key.toString('base64')}`
  const signature = crypto.createHmac('sha256', key).update(`${webhookId}.${timestamp}.${rawBody}`).digest('base64')
  assert.equal(verifyResendWebhook({ rawBody, webhookId, timestamp, signature: `v1,${signature}`, secret, now }), true)
  assert.equal(verifyResendWebhook({ rawBody, webhookId, timestamp, signature: `v1,${signature}`, secret, now: now + 301_000 }), false)
  assert.equal(verifyResendWebhook({ rawBody: `${rawBody} `, webhookId, timestamp, signature: `v1,${signature}`, secret, now }), false)
})

test('audience modes discard stale filters and always preserve delivery eligibility clauses', () => {
  const all = normalizeAudienceFilter({ mode: 'all', tag: 'Old tag', subscriberIds: ['29a67322-5f32-4eb2-a0b6-e7329c348d58'] })
  assert.deepEqual(all, { mode: 'all', tag: '', segment: '', source: '', subscriberIds: [] })

  const filtered = normalizeAudienceFilter({ mode: 'filtered', tag: ' Reflection ', subscriberIds: ['29a67322-5f32-4eb2-a0b6-e7329c348d58'] })
  assert.equal(filtered.tag, 'Reflection')
  assert.deepEqual(filtered.subscriberIds, [])

  const selected = audienceFilterSql({ mode: 'selected', tag: 'Old tag', subscriberIds: ['29a67322-5f32-4eb2-a0b6-e7329c348d58'] })
  assert.equal(selected.filter.tag, '')
  assert.match(selected.where, /status = 'subscribed'/)
  assert.match(selected.where, /consent_status = 'granted'/)
  assert.match(selected.where, /newsletter_suppressions/)
  assert.match(selected.where, /ANY\(/)
})

test('letter validation warns when a selected image has no alternative text', () => {
  const design = normalizeDesign({
    blocks: [
      createLetterBlock('text', { content: { text: 'A complete letter.' } }),
      createLetterBlock('image', { id: 'hero-image', content: { assetId: 'asset-1', alt: '' } }),
    ],
  })
  const validation = validateLetter({ title: 'July reflection', subject: 'A thoughtful note', design })
  assert.equal(validation.ok, true)
  assert.match(validation.warnings.join(' '), /hero-image needs alternative text/i)
})

test('production renderer includes a mobile stacking rule for two-column letters', () => {
  const rendered = renderLetter({
    subject: 'Responsive letter',
    design: {
      blocks: [
        createLetterBlock('two_column', { id: 'responsive-columns', content: { left: 'Left', right: 'Right' } }),
      ],
    },
  })
  assert.match(rendered.html, /class="pwc-two-column"/)
  assert.match(rendered.html, /class="pwc-column"/)
  assert.match(rendered.html, /@media only screen and \(max-width:600px\)/)
  assert.match(rendered.text, /Left\s+Right/)
})

test('broadcast preflight blocks unsafe delivery and reports a changed audience snapshot', () => {
  const preflight = buildBroadcastPreflight({
    broadcast: { status: 'draft', recipient_count: 12 },
    validation: { ok: true, errors: [], warnings: ['Image needs alternative text.'] },
    eligibleRecipients: 10,
    providerConfigured: true,
    outgoingEmailAvailable: false,
  })
  assert.equal(preflight.ready, false)
  assert.equal(preflight.status, 'blocked')
  assert.equal(preflight.checks.snapshotFresh, false)
  assert.match(preflight.blockers.join(' '), /paused or unavailable/i)
  assert.match(preflight.warnings.join(' '), /changed from 12 to 10/i)
})

test('broadcast preflight becomes ready only when every delivery gate passes', () => {
  const preflight = buildBroadcastPreflight({
    broadcast: { status: 'draft', recipient_count: 10 },
    validation: { ok: true, errors: [], warnings: [] },
    eligibleRecipients: 10,
    providerConfigured: true,
    outgoingEmailAvailable: true,
  })
  assert.equal(preflight.ready, true)
  assert.equal(preflight.status, 'ready')
  assert.deepEqual(preflight.blockers, [])
  assert.equal(preflight.checks.snapshotFresh, true)
})

test('existing version 1 letter fixtures remain compatible and normalize deterministically', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'letters', 'version-1-letter.json')
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  const normalized = normalizeDesign(fixture.design)

  assert.equal(fixture.design.version, 1)
  assert.equal(normalized.version, 1)
  assert.equal(normalized.blocks.at(-1).type, 'unsubscribe')
  assert.equal(normalized.blocks.find((block) => block.id === 'fixture-heading').content.text, 'A quieter way forward')
  assert.deepEqual(normalizeDesign(normalized), normalized)
})

test('prepared broadcast fixture remains unchanged when its source letter is edited later', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'letters', 'version-1-letter.json')
  const source = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  const preparedSnapshot = structuredClone({
    title: source.title,
    subject: source.subject,
    previewText: source.previewText,
    design: normalizeDesign(source.design),
    audienceFilter: source.audienceFilter,
  })

  source.title = 'A later draft'
  source.subject = 'A revised subject'
  source.design.blocks[0].content.text = 'Rewritten after preparation'
  source.audienceFilter.tag = 'Later segment'

  assert.equal(preparedSnapshot.title, 'July reflection')
  assert.equal(preparedSnapshot.subject, 'A thoughtful note for {{firstName}}')
  assert.equal(preparedSnapshot.design.blocks[0].content.text, 'A quieter way forward')
  assert.equal(preparedSnapshot.audienceFilter.tag, 'Reflection')
})

test('autosave conflicts, immutable snapshots, and dispatcher recovery risk stay characterized', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'letterBuilder.routes.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'letterBroadcast.service.js'), 'utf8')

  assert.match(routes, /LETTER_REVISION_CONFLICT/)
  assert.match(routes, /title_snapshot = \$2, subject_snapshot = \$3/)
  assert.match(routes, /design_snapshot = \$5::jsonb/)
  assert.match(routes, /req\.user\?\.role !== 'developer'/)
  const dueSelection = service.match(/SELECT id FROM letter_broadcasts WHERE[^`]+/)?.[0] || ''
  assert.match(dueSelection, /status = 'scheduled' AND scheduled_at <= now\(\)/)
  assert.doesNotMatch(dueSelection, /processing/)
})

test('broadcast lifecycle is independent from the editable source letter', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'letterBuilder.routes.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'letterBroadcast.service.js'), 'utf8')
  const editor = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'admin', 'AdminLetters.jsx'), 'utf8')

  assert.match(routes, /if \(current\.status === 'archived'\)/)
  assert.match(routes, /if \(letter\.status === 'archived'\)/)
  assert.doesNotMatch(routes, /UPDATE letter_documents SET status = 'scheduled'/)
  assert.doesNotMatch(routes, /UPDATE letter_documents SET status = 'cancelled'/)
  assert.doesNotMatch(service, /UPDATE letter_documents SET status = 'sending'/)
  assert.doesNotMatch(service, /UPDATE letter_documents SET status = 'sent'/)
  assert.match(editor, /const readOnly = working\?\.status === 'archived'/)
})
