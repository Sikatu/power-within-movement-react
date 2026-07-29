const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  normalizeDesign,
  renderLetter,
} = require('../src/services/letterBuilder.service')
const {
  PROCESSING_STALE_AFTER_MS,
  canClaimBroadcast,
  createBroadcastSnapshot,
  isStaleProcessingBroadcast,
} = require('../src/services/letterBroadcast.service')

test('legacy version-1 letter documents remain compatible with the current renderer', () => {
  const legacy = {
    version: 1,
    settings: {
      backgroundColor: '#f6eee9',
      contentColor: '#fffdf9',
      textColor: '#4d343c',
      accentColor: '#7a3f50',
      contentWidth: 640,
    },
    blocks: [
      {
        id: 'legacy-heading',
        type: 'heading',
        content: { text: 'A legacy letter', level: 1 },
        settings: { align: 'center', padding: 24 },
      },
      {
        id: 'legacy-text',
        type: 'text',
        content: { text: 'Existing content remains readable.' },
        settings: { align: 'left', padding: 16 },
      },
    ],
  }

  const normalized = normalizeDesign(legacy)
  const rendered = renderLetter({
    design: normalized,
    subject: 'Compatibility check',
    variables: {},
    unsubscribeUrl: 'https://example.test/unsubscribe',
  })

  assert.equal(normalized.version, 1)
  assert.equal(normalized.blocks.at(-1).type, 'unsubscribe')
  assert.match(rendered.html, /A legacy letter/)
  assert.match(rendered.text, /Existing content remains readable/)
})

test('broadcast content snapshots are detached from later source-letter edits', () => {
  const letter = {
    title: 'Original title',
    subject: 'Original subject',
    preview_text: 'Original preview',
    design: {
      version: 1,
      settings: {},
      blocks: [
        {
          id: 'message',
          type: 'text',
          content: { text: 'Original message' },
          settings: { align: 'left', padding: 16 },
        },
      ],
    },
  }

  const snapshot = createBroadcastSnapshot(letter)

  letter.title = 'Changed title'
  letter.subject = 'Changed subject'
  letter.preview_text = 'Changed preview'
  letter.design.blocks[0].content.text = 'Changed message'

  assert.equal(snapshot.title, 'Original title')
  assert.equal(snapshot.subject, 'Original subject')
  assert.equal(snapshot.previewText, 'Original preview')
  assert.equal(snapshot.design.blocks[0].content.text, 'Original message')
  assert.equal(snapshot.design.blocks.at(-1).type, 'unsubscribe')
})

test('normal broadcast claims reject duplicate or already-completed delivery states', () => {
  for (const status of ['draft', 'scheduled', 'failed']) {
    assert.equal(canClaimBroadcast({ status }), true, status)
  }

  for (const status of ['processing', 'sent', 'partial', 'cancelled']) {
    assert.equal(canClaimBroadcast({ status }), false, status)
  }
})

test('only stale processing broadcasts may be explicitly resumed by the scheduler', () => {
  const now = Date.parse('2026-07-23T12:00:00.000Z')
  const stale = {
    status: 'processing',
    updated_at: new Date(now - PROCESSING_STALE_AFTER_MS - 1).toISOString(),
  }
  const fresh = {
    status: 'processing',
    updated_at: new Date(now - PROCESSING_STALE_AFTER_MS + 1).toISOString(),
  }

  assert.equal(isStaleProcessingBroadcast(stale, now), true)
  assert.equal(isStaleProcessingBroadcast(fresh, now), false)
  assert.equal(canClaimBroadcast(stale, { allowStaleProcessing: false, now }), false)
  assert.equal(canClaimBroadcast(stale, { allowStaleProcessing: true, now }), true)
  assert.equal(canClaimBroadcast(fresh, { allowStaleProcessing: true, now }), false)
})

test('the existing Letters route remains singular and protected in place', () => {
  const app = fs.readFileSync(
    path.resolve(__dirname, '../../src/App.jsx'),
    'utf8',
  )
  const routeMatches = app.match(/path="\/admin\/letters"/g) || []

  assert.equal(routeMatches.length, 1)
  assert.match(app, /<AdminRouteGuard><AdminLetters \/><\/AdminRouteGuard>/)
  assert.doesNotMatch(app, /email-builder-v2|new-letters|broadcast-studio-new/)
})

test('the standard Letters UI does not expose manual dispatcher execution', () => {
  const page = fs.readFileSync(
    path.resolve(__dirname, '../../src/pages/admin/AdminLetters.jsx'),
    'utf8',
  )

  assert.doesNotMatch(page, /Process due now/)
  assert.doesNotMatch(page, /runDueBroadcasts/)
  assert.doesNotMatch(page, /processDueLetterBroadcasts/)
})
