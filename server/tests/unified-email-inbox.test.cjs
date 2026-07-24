const assert = require('node:assert/strict')
const test = require('node:test')

const {
  extractDisplayName,
  extractReplyRoute,
  htmlToPlainText,
  normalizeEmailAddress,
  normalizeReferences,
  recipientReplyTo,
  retrieveReceivedEmail,
} = require('../src/services/inboundEmail.service')

test('normalizes mailbox addresses and display names', () => {
  assert.equal(normalizeEmailAddress('Kim Example <Kim@Example.com>'), 'kim@example.com')
  assert.equal(extractDisplayName('Kim Example <kim@example.com>'), 'Kim Example')
  assert.equal(normalizeEmailAddress('not an email'), '')
})

test('extracts a valid per-recipient reply alias', () => {
  const route = extractReplyRoute(
    ['replies+ABCDEF1234567890@updates.kimmittelstadt.com'],
    'updates.kimmittelstadt.com',
  )

  assert.equal(route.accepted, true)
  assert.equal(route.alias, 'abcdef1234567890')
  assert.equal(route.reason, 'recipient_alias')
})

test('accepts the direct replies mailbox and rejects unrelated local parts', () => {
  const direct = extractReplyRoute(
    ['replies@updates.kimmittelstadt.com'],
    'updates.kimmittelstadt.com',
  )
  const unrelated = extractReplyRoute(
    ['hello@updates.kimmittelstadt.com'],
    'updates.kimmittelstadt.com',
  )

  assert.equal(direct.accepted, true)
  assert.equal(direct.alias, '')
  assert.equal(unrelated.accepted, false)
  assert.equal(unrelated.reason, 'unsupported_destination')
})

test('builds a per-recipient Reply-To only with a safe alias and configured domain', () => {
  assert.equal(
    recipientReplyTo(
      { reply_alias: 'abcdef1234567890' },
      'updates.kimmittelstadt.com',
    ),
    'Power Within Collective <replies+abcdef1234567890@updates.kimmittelstadt.com>',
  )

  assert.equal(recipientReplyTo({ reply_alias: 'bad alias' }, 'updates.kimmittelstadt.com'), '')
  assert.equal(recipientReplyTo({ reply_alias: 'abcdef1234567890' }, ''), '')
})

test('converts fallback HTML into readable text', () => {
  const value = htmlToPlainText(
    '<style>.hidden{display:none}</style><p>Hello &amp; welcome.</p><p>Second line<br>Next line</p>',
  )

  assert.equal(value, 'Hello & welcome.\n\nSecond line\nNext line')
})

test('normalizes email reference headers', () => {
  assert.deepEqual(
    normalizeReferences('<one@example.com> <two@example.com>'),
    ['<one@example.com>', '<two@example.com>'],
  )
})

test('retrieves received email content from the Resend Receiving endpoint', async () => {
  let requestUrl = ''
  let requestOptions = null

  const result = await retrieveReceivedEmail('email-123', {
    apiKey: 're_test_key',
    fetchImpl: async (url, options) => {
      requestUrl = url
      requestOptions = options
      return {
        ok: true,
        async json() {
          return {
            id: 'email-123',
            text: 'Hello',
          }
        },
      }
    },
  })

  assert.equal(requestUrl, 'https://api.resend.com/emails/receiving/email-123')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.headers.Authorization, 'Bearer re_test_key')
  assert.equal(result.text, 'Hello')
})

test('surfaces provider retrieval failures without exposing credentials', async () => {
  await assert.rejects(
    retrieveReceivedEmail('email-404', {
      apiKey: 're_test_key',
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        async json() {
          return { message: 'Email not found.' }
        },
      }),
    }),
    (error) => {
      assert.equal(error.code, 'INBOUND_EMAIL_RETRIEVAL_FAILED')
      assert.equal(error.statusCode, 502)
      assert.equal(error.message, 'Email not found.')
      return true
    },
  )
})
