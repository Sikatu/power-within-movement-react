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
  STALE_PROCESSING_MINUTES,
  audienceFilterSql,
  buildBroadcastPreflight,
  normalizeAudienceFilter,
} = require('../src/services/letterBroadcast.service')
const {
  DELIVERY_CHANGE_CUTOFF_MINUTES,
  assertDeliveryChangeOutsideCutoff,
  letterCapabilities,
} = require('../src/services/letterPermissions.service')
const { buildLetterAnalytics, percentage } = require('../src/services/letterAnalytics.service')

test('Phase 10 analytics use delivered recipients for engagement rates', () => {
  const analytics = buildLetterAnalytics({
    sent_count: 100,
    delivered_count: 80,
    opened_count: 40,
    clicked_count: 10,
    bounced_count: 5,
    unsubscribed_count: 2,
  })
  assert.equal(analytics.deliveryRate, 80)
  assert.equal(analytics.openRate, 50)
  assert.equal(analytics.clickRate, 12.5)
  assert.equal(analytics.clickToOpenRate, 25)
  assert.equal(analytics.bounceRate, 5)
  assert.equal(analytics.unsubscribeRate, 2.5)
  assert.equal(analytics.openTrackingIsEstimate, true)
})

test('Phase 10 analytics remain finite when provider delivery data is absent', () => {
  assert.equal(percentage(10, 0), 0)
  const analytics = buildLetterAnalytics({ sent_count: 20, opened_count: 4, clicked_count: 1 })
  assert.equal(analytics.openRate, 20)
  assert.equal(analytics.clickRate, 5)
})

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

test('design normalization preserves safe block fonts and image crop settings', () => {
  const normalized = normalizeDesign({
    blocks: [
      createLetterBlock('heading', {
        id: 'heading-custom-font',
        settings: { fontFamily: 'Verdana, Geneva, sans-serif' },
      }),
      createLetterBlock('image', {
        id: 'image-custom-crop',
        settings: {
          imageFit: 'crop',
          cropHeight: 340,
          positionX: 25,
          positionY: 70,
          zoom: 135,
        },
      }),
    ],
  })
  const heading = normalized.blocks.find((block) => block.id === 'heading-custom-font')
  const image = normalized.blocks.find((block) => block.id === 'image-custom-crop')

  assert.equal(heading.settings.fontFamily, 'Verdana, Geneva, sans-serif')
  assert.equal(image.settings.imageFit, 'crop')
  assert.equal(image.settings.cropHeight, 340)
  assert.equal(image.settings.positionX, 25)
  assert.equal(image.settings.positionY, 70)
  assert.equal(image.settings.zoom, 135)
})

test('broadcast HTML includes saved block fonts and image positioning', () => {
  const rendered = renderLetter({
    subject: 'A thoughtful note',
    design: {
      blocks: [
        createLetterBlock('heading', {
          id: 'heading-font',
          content: { text: 'Welcome' },
          settings: { fontFamily: 'Tahoma, Geneva, sans-serif' },
        }),
        createLetterBlock('image', {
          id: 'cropped-image',
          content: { assetId: 'asset-1', alt: 'A welcoming portrait' },
          settings: {
            width: 80,
            imageFit: 'crop',
            cropHeight: 300,
            positionX: 20,
            positionY: 75,
            zoom: 140,
          },
        }),
      ],
    },
    assetUrl: () => 'https://example.com/image.jpg',
  })

  assert.match(rendered.html, /font-family:Tahoma, Geneva, sans-serif/)
  assert.match(rendered.html, /object-position:20% 75%/)
  assert.match(rendered.html, /height:300px/)
  assert.match(rendered.html, /width:140%/)
})

test('image blocks preserve and render personalized beside text for left and right layouts', () => {
  const normalized = normalizeDesign({
    blocks: [
      createLetterBlock('image', {
        id: 'image-with-text',
        content: {
          assetId: 'asset-1',
          alt: 'Kim welcoming a client',
          caption: 'A thoughtful moment',
          besideText: 'Hello {{firstName}},\nThis belongs beside the image.',
        },
        settings: { align: 'right', width: 40 },
      }),
    ],
  })
  const image = normalized.blocks.find((block) => block.id === 'image-with-text')
  assert.equal(image.content.besideText, 'Hello {{firstName}},\nThis belongs beside the image.')

  const rendered = renderLetter({
    subject: 'A note',
    design: normalized,
    variables: { firstName: 'Ari' },
    assetUrl: () => 'https://example.com/image.jpg',
  })
  assert.match(rendered.html, /class="pwc-image-with-text"/)
  assert.match(rendered.html, /Hello Ari,<br>This belongs beside the image\./)
  assert.match(rendered.html, /class="pwc-image-column" width="60%".*Hello Ari.*class="pwc-image-column" width="40%"/s)
  assert.match(rendered.html, /pwc-image-with-text.*display:block!important/)
  assert.match(rendered.text, /Hello Ari/)
})

test('centered images remain standalone even when legacy beside text exists', () => {
  const rendered = renderLetter({
    subject: 'A note',
    design: {
      blocks: [
        createLetterBlock('image', {
          content: { assetId: 'asset-1', besideText: 'Do not show beside centered media.' },
          settings: { align: 'center', width: 70 },
        }),
      ],
    },
    assetUrl: () => 'https://example.com/image.jpg',
  })
  assert.doesNotMatch(rendered.html, /class="pwc-image-with-text"/)
  assert.doesNotMatch(rendered.html, /Do not show beside centered media/)
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
  assert.match(routes, /requireLetterAction\('recovery'\)/)
  assert.equal(STALE_PROCESSING_MINUTES, 15)
  assert.match(service, /FOR UPDATE SKIP LOCKED/)
  assert.match(service, /status = 'processing'/)
  assert.match(service, /Recovered automatically after an interrupted delivery worker/)
  assert.match(service, /Idempotency-Key/)
  assert.match(service, /pwc-letter-\$\{recipient\.id\}/)
  assert.match(routes, /retry-failed/)
  assert.match(routes, /delivery_status = 'pending'/)
})

test('failed-recipient recovery is bounded and preserves successful deliveries', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'letterBuilder.routes.js'), 'utf8')
  const retryRoute = routes.match(/router\.post\('\/broadcasts\/:broadcastId\/retry-failed'[\s\S]+?\r?\n\}\)\r?\n/)?.[0] || ''

  assert.match(retryRoute, /status IN \('failed', 'partial'\)/)
  assert.match(retryRoute, /delivery_status = 'failed'/)
  assert.match(retryRoute, /delivery_status = 'pending'/)
  assert.doesNotMatch(retryRoute, /delivery_status IN \('sent'/)
  assert.match(retryRoute, /letter_broadcast_retry_queued/)
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

test('letter delivery capabilities separate authoring from live delivery authority', () => {
  const staff = letterCapabilities(
    { role: 'staff' },
    { permissions: { communications: 'manage' } },
  )
  assert.equal(staff.edit, true)
  assert.equal(staff.test, true)
  assert.equal(staff.schedule, false)
  assert.equal(staff.send, false)
  assert.equal(staff.cancel, false)
  assert.equal(staff.retry, false)

  const owner = letterCapabilities({ role: 'owner' })
  assert.equal(owner.send, true)
  assert.equal(owner.cancel, true)
  assert.equal(owner.recovery, false)
  assert.equal(letterCapabilities({ role: 'developer' }).recovery, true)
})

test('scheduled delivery changes close five minutes before dispatch', () => {
  assert.equal(DELIVERY_CHANGE_CUTOFF_MINUTES, 5)
  const now = new Date('2026-07-24T10:00:00.000Z')
  assert.doesNotThrow(() => assertDeliveryChangeOutsideCutoff({
    status: 'scheduled',
    scheduled_at: '2026-07-24T10:06:00.000Z',
  }, now))
  assert.throws(() => assertDeliveryChangeOutsideCutoff({
    status: 'scheduled',
    scheduled_at: '2026-07-24T10:04:59.000Z',
  }, now), (error) => error.code === 'LETTER_DELIVERY_CUTOFF_ACTIVE' && error.statusCode === 409)
})
