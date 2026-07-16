const test = require('node:test')
const assert = require('node:assert/strict')

async function loadQaHelpers() {
  return import('../../src/components/admin/adminReleaseQa.js')
}

test('release QA accepts a valid collection response', async () => {
  const { inspectReleaseQaResponse } = await loadQaHelpers()
  const result = inspectReleaseQaResponse({
    response: { ok: true, clients: [{ id: 'client-1' }] },
    durationMs: 220,
    contract: {
      collectionPaths: ['clients'],
      requiredPaths: ['ok'],
      densityThreshold: 40,
    },
  })

  assert.equal(result.status, 'pass')
  assert.equal(result.count, 1)
  assert.equal(result.durationMs, 220)
})

test('release QA rejects malformed endpoint payloads', async () => {
  const { inspectReleaseQaResponse } = await loadQaHelpers()
  const result = inspectReleaseQaResponse({
    response: { ok: true },
    durationMs: 180,
    contract: {
      collectionPaths: ['sessions'],
      requiredPaths: ['summary'],
    },
  })

  assert.equal(result.status, 'fail')
  assert.match(result.notes.join(' '), /Missing required response field/)
  assert.match(result.notes.join(' '), /Expected one collection field/)
})

test('release QA flags high-density and slow responses for review', async () => {
  const { inspectReleaseQaResponse } = await loadQaHelpers()
  const result = inspectReleaseQaResponse({
    response: { tasks: Array.from({ length: 50 }, (_, index) => ({ id: index })) },
    durationMs: 1600,
    contract: {
      route: '/admin/attention',
      collectionPaths: ['tasks'],
      densityThreshold: 35,
    },
  })

  assert.equal(result.status, 'review')
  assert.equal(result.count, 50)
  assert.match(result.notes.join(' '), /High-density state/)
  assert.match(result.notes.join(' '), /1600 ms/)
})

test('release QA summary blocks deployment when a check fails', async () => {
  const { summarizeReleaseQaResults } = await loadQaHelpers()
  const summary = summarizeReleaseQaResults([
    { status: 'pass', durationMs: 100 },
    { status: 'review', durationMs: 200 },
    { status: 'fail', durationMs: 300 },
  ])

  assert.equal(summary.completed, 3)
  assert.equal(summary.passed, 1)
  assert.equal(summary.review, 1)
  assert.equal(summary.failed, 1)
  assert.equal(summary.averageLatencyMs, 200)
  assert.equal(summary.ready, false)
})

test('release QA summary keeps review findings out of the signed deployment gate', async () => {
  const { summarizeReleaseQaResults } = await loadQaHelpers()
  const summary = summarizeReleaseQaResults([
    { status: 'pass', durationMs: 100 },
    { status: 'review', durationMs: 200 },
  ])

  assert.equal(summary.failed, 0)
  assert.equal(summary.review, 1)
  assert.equal(summary.ready, false)
})

test('release QA maps integrated readiness blockers into a failed contract', async () => {
  const { inspectReleaseQaResponse } = await loadQaHelpers()
  const result = inspectReleaseQaResponse({
    response: { summary: { status: 'blocked' }, checks: [] },
    durationMs: 100,
    contract: {
      requiredPaths: ['summary'],
      collectionPaths: ['checks'],
      releaseStatePath: 'summary.status',
    },
  })

  assert.equal(result.status, 'fail')
  assert.match(result.notes.join(' '), /deployment blockers/)
})
