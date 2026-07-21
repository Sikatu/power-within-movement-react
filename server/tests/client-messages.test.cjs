const test = require('node:test')
const assert = require('node:assert/strict')

const {
  CLIENT_MESSAGE_TYPES,
  getClientMessageLanguage,
  normalizeClientMessageType,
} = require('../src/services/clientMessages.service')

test('client messages support encouragements and portal announcements only', () => {
  assert.deepEqual(CLIENT_MESSAGE_TYPES, ['encouragement', 'announcement'])
})

test('unknown client message types safely fall back to encouragement', () => {
  assert.equal(normalizeClientMessageType('announcement'), 'announcement')
  assert.equal(normalizeClientMessageType('external_link'), 'encouragement')
  assert.equal(normalizeClientMessageType(), 'encouragement')
})

test('portal announcements use clear high-importance notification language', () => {
  assert.deepEqual(getClientMessageLanguage('announcement'), {
    messageType: 'announcement',
    singular: 'announcement',
    title: 'A new portal announcement is ready',
    actionLabel: 'Read Announcement',
    importance: 'high',
  })
})

test('encouragements retain calm default notification language', () => {
  assert.deepEqual(getClientMessageLanguage('encouragement'), {
    messageType: 'encouragement',
    singular: 'encouragement',
    title: 'A new encouragement is waiting',
    actionLabel: 'Read Encouragement',
    importance: 'normal',
  })
})
