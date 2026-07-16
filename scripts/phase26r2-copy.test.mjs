import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeveloperErrorCopy, redactTechnicalText } from '../src/lib/safeTechnicalCopy.js'

test('Developer Operations copy redacts credentials and personal identifiers', () => {
  const output = redactTechnicalText('Authorization: Bearer top.secret.token password=hunter2 owner@example.com 6ba7b810-9dad-11d1-80b4-00c04fd430c8')
  assert.doesNotMatch(output, /top\.secret|hunter2|owner@example\.com|6ba7b810/i)
  assert.match(output, /redacted/i)
})

test('Developer Operations summary omits metadata and raw request identity', () => {
  const output = buildDeveloperErrorCopy({
    title: 'Portal failed for owner@example.com',
    severity: 'high',
    status: 'open',
    source: 'api',
    route: '/api/private',
    method: 'POST',
    requestId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    metadata: { password: 'do-not-copy' },
  })
  assert.match(output, /Portal failed for \[redacted-email\]/)
  assert.doesNotMatch(output, /request id|do-not-copy/i)
})
