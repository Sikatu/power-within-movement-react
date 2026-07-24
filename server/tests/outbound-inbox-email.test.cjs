const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildThreadingHeaders,
  createInboxEmailPayload,
  replySubject,
} = require('../src/services/outboundInboxEmail.service')

test('replySubject adds Re only once', () => {
  assert.equal(replySubject('Welcome'), 'Re: Welcome')
  assert.equal(replySubject('Re: Welcome'), 'Re: Welcome')
})

test('buildThreadingHeaders follows the latest inbound RFC message id', () => {
  const result = buildThreadingHeaders([
    {
      channel: 'email',
      internet_message_id: '<first@example.com>',
      reference_ids: ['<origin@example.com>'],
    },
    {
      channel: 'email',
      internet_message_id: '<latest@example.com>',
      reference_ids: ['<origin@example.com>', '<first@example.com>'],
    },
  ])

  assert.equal(result.inReplyTo, '<latest@example.com>')
  assert.deepEqual(result.referenceIds, [
    '<origin@example.com>',
    '<first@example.com>',
    '<latest@example.com>',
  ])
  assert.equal(result.headers['In-Reply-To'], '<latest@example.com>')
  assert.equal(
    result.headers.References,
    '<origin@example.com> <first@example.com> <latest@example.com>',
  )
})

test('createInboxEmailPayload keeps a broadcast reply alias active', () => {
  const payload = createInboxEmailPayload({
    conversation: {
      subject: 'A note from Kim',
      external_email: 'reader@example.com',
      reply_alias: '1234567890abcdef',
    },
    messages: [{
      channel: 'email',
      internet_message_id: '<reader-reply@example.com>',
      reference_ids: [],
    }],
    body: 'Thank you for writing back.',
    configuredFrom: 'Power Within Collective <hello@updates.example.com>',
    configuredReplyTo: 'team@example.com',
    receivingDomain: 'updates.example.com',
  })

  assert.equal(payload.to, 'reader@example.com')
  assert.equal(payload.fromAddress, 'hello@updates.example.com')
  assert.equal(payload.subject, 'Re: A note from Kim')
  assert.equal(
    payload.replyTo,
    'Power Within Collective <replies+1234567890abcdef@updates.example.com>',
  )
  assert.equal(payload.headers['In-Reply-To'], '<reader-reply@example.com>')
  assert.match(payload.text, /With care,\nPower Within Collective/)
})

test('createInboxEmailPayload rejects a missing recipient', () => {
  assert.throws(
    () => createInboxEmailPayload({
      conversation: { subject: 'Missing address' },
      body: 'Hello',
      configuredFrom: 'hello@example.com',
    }),
    /does not have a valid recipient address/,
  )
})