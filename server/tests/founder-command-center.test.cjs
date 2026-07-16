const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_COMPARISON_TIMEZONES,
  DEFAULT_PRIMARY_TIMEZONE,
  extractTranscript,
  getTranscriptionConfiguration,
  isValidTimeZone,
  normalizeComparisonTimeZones,
} = require('../src/services/founderTranscription.service')

test('Founder clock defaults to Chicago with the requested comparison zones', () => {
  assert.equal(DEFAULT_PRIMARY_TIMEZONE, 'America/Chicago')
  assert.deepEqual(DEFAULT_COMPARISON_TIMEZONES, [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Asia/Manila',
    'Europe/London',
  ])
})

test('timezone validation accepts IANA zones and rejects invalid input', () => {
  assert.equal(isValidTimeZone('America/Chicago'), true)
  assert.equal(isValidTimeZone('Asia/Manila'), true)
  assert.equal(isValidTimeZone('Not/A_Timezone'), false)
  assert.equal(isValidTimeZone(''), false)
})

test('comparison timezone normalization removes duplicates and invalid zones', () => {
  assert.deepEqual(normalizeComparisonTimeZones([
    'America/New_York',
    'America/New_York',
    'Bad/Timezone',
    ' Europe/London ',
  ]), ['America/New_York', 'Europe/London'])
  assert.equal(normalizeComparisonTimeZones(DEFAULT_COMPARISON_TIMEZONES, 3).length, 3)
})

test('disabled transcription is truthful and never exposes server secrets', () => {
  const state = getTranscriptionConfiguration({
    founderTranscriptionProvider: 'disabled',
    founderTranscriptionApiUrl: 'https://secret.example.test/transcribe',
    founderTranscriptionApiKey: 'private-key',
    founderTranscriptionModel: 'private-model',
  })
  assert.equal(state.configured, false)
  assert.equal(state.canRequest, false)
  assert.equal(state.status, 'disabled')
  assert.doesNotMatch(JSON.stringify(state), /private-key|secret\.example|private-model/)
})

test('generic transcription requires both a server endpoint and credential', () => {
  const incomplete = getTranscriptionConfiguration({
    founderTranscriptionProvider: 'generic',
    founderTranscriptionApiUrl: 'https://provider.example.test/transcribe',
    founderTranscriptionApiKey: '',
  })
  assert.equal(incomplete.configured, false)
  assert.equal(incomplete.status, 'incomplete')
  assert.match(incomplete.message, /credential/i)

  const ready = getTranscriptionConfiguration({
    founderTranscriptionProvider: 'generic',
    founderTranscriptionApiUrl: 'https://provider.example.test/transcribe',
    founderTranscriptionApiKey: 'server-only-key',
  })
  assert.equal(ready.configured, true)
  assert.equal(ready.status, 'ready')
  assert.doesNotMatch(JSON.stringify(ready), /server-only-key|provider\.example/)
})

test('generic provider transcript extraction accepts supported response shapes', () => {
  assert.equal(extractTranscript({ text: ' First transcript. ' }), 'First transcript.')
  assert.equal(extractTranscript({ transcript: 'Second transcript.' }), 'Second transcript.')
  assert.equal(extractTranscript({ result: { text: 'Third transcript.' } }), 'Third transcript.')
  assert.equal(extractTranscript('Plain transcript.'), 'Plain transcript.')
  assert.equal(extractTranscript({}), '')
})
