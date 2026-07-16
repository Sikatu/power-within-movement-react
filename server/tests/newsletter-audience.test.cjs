const test = require('node:test')
const assert = require('node:assert/strict')

const {
  canReceiveNewsletter,
  isValidEmail,
  mergeDuplicateRecipients,
  mergeSubscriberRecords,
  normalizeEmail,
  parseAudienceCsv,
  parseBooleanConsent,
  suppressionReasonForStatus,
  uniqueLabels,
} = require('../src/services/newsletterAudience.service')

test('audience email normalization is case-insensitive and trims whitespace', () => {
  assert.equal(normalizeEmail('  Notes@Example.COM '), 'notes@example.com')
  assert.equal(isValidEmail('Notes@Example.COM'), true)
  assert.equal(isValidEmail('not-an-email'), false)
})

test('audience CSV parser supports quoted fields and explicit consent evidence', () => {
  const parsed = parseAudienceCsv([
    'email,first_name,last_name,tags,segments,consent,consent_at',
    'jane@example.com,Jane,Doe,"Reflection; Events","New season",yes,2026-07-15T10:00:00.000Z',
  ].join('\n'))

  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.recipients[0].email, 'jane@example.com')
  assert.deepEqual(parsed.recipients[0].tags, ['Reflection', 'Events'])
  assert.deepEqual(parsed.recipients[0].segments, ['New season'])
  assert.equal(parsed.recipients[0].status, 'subscribed')
  assert.equal(parsed.recipients[0].consentStatus, 'granted')
})

test('audience CSV leaves rows pending when consent evidence is absent', () => {
  const parsed = parseAudienceCsv('email,first_name\npending@example.com,Pat')
  assert.equal(parsed.recipients[0].status, 'pending')
  assert.equal(parsed.recipients[0].consentStatus, 'not_recorded')
  assert.equal(parsed.recipients[0].explicitConsent, false)
})

test('audience CSV isolates invalid rows without discarding valid rows', () => {
  const parsed = parseAudienceCsv('email,first_name\nvalid@example.com,Val\ninvalid,Nope')
  assert.equal(parsed.recipients.length, 1)
  assert.equal(parsed.errors.length, 1)
  assert.equal(parsed.errors[0].line, 3)
})

test('case-insensitive duplicate recipients merge tags and retain consent', () => {
  const merged = mergeDuplicateRecipients([
    { email: 'HELLO@example.com', tags: ['Events'], explicitConsent: true, consentStatus: 'granted' },
    { email: 'hello@example.com', tags: ['Reflection'], firstName: 'Kim', status: 'pending' },
  ])

  assert.equal(merged.duplicates, 1)
  assert.equal(merged.recipients.length, 1)
  assert.equal(merged.recipients[0].email, 'hello@example.com')
  assert.deepEqual(merged.recipients[0].tags, ['Events', 'Reflection'])
  assert.equal(merged.recipients[0].status, 'subscribed')
  assert.equal(merged.recipients[0].consentStatus, 'granted')
})

test('subscriber merge fills names without losing established fields', () => {
  const merged = mergeSubscriberRecords(
    { email: 'member@example.com', firstName: 'Ari', tags: ['Existing'], notes: 'Original' },
    { email: 'MEMBER@example.com', lastName: 'Lane', tags: ['New'] },
  )
  assert.equal(merged.firstName, 'Ari')
  assert.equal(merged.lastName, 'Lane')
  assert.equal(merged.notes, 'Original')
  assert.deepEqual(merged.tags, ['Existing', 'New'])
})

test('delivery eligibility requires subscribed status, granted consent, and no suppression', () => {
  const subscriber = { status: 'subscribed', consent_status: 'granted', suppression_reason: null }
  assert.equal(canReceiveNewsletter(subscriber, false), true)
  assert.equal(canReceiveNewsletter({ ...subscriber, status: 'pending' }, false), false)
  assert.equal(canReceiveNewsletter({ ...subscriber, consent_status: 'not_recorded' }, false), false)
  assert.equal(canReceiveNewsletter(subscriber, true), false)
})

test('suppression helpers cover unsubscribe, bounce, complaint, and manual suppression', () => {
  assert.equal(suppressionReasonForStatus('unsubscribed'), 'unsubscribed')
  assert.equal(suppressionReasonForStatus('bounced'), 'bounced')
  assert.equal(suppressionReasonForStatus('complained'), 'complained')
  assert.equal(suppressionReasonForStatus('suppressed'), 'manual')
  assert.equal(parseBooleanConsent('yes'), true)
  assert.equal(parseBooleanConsent('no'), false)
  assert.deepEqual(uniqueLabels(['Events', 'events', ' Reflection ']), ['Events', 'Reflection'])
})
