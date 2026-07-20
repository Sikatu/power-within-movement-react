import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PHASE30_EVIDENCE_GATES,
  validatePhase30Evidence,
} from './lib/phase30ReleaseGate.mjs'

function completeManifest() {
  return {
    phase: 50,
    release: {
      commit: 'a'.repeat(40),
      tag: 'phase50-production-20260721',
      environment: 'production',
      candidateUrl: 'https://candidate.example.com',
      verifiedAt: '2026-07-16T12:00:00Z',
    },
    evidence: Object.fromEntries(PHASE30_EVIDENCE_GATES.map((gate) => [gate.id, {
      status: 'passed',
      checkedBy: 'release-checker',
      checkedAt: '2026-07-16T12:00:00Z',
      notes: 'Evidence retained in the release folder.',
      artifact: 'release-artifacts/evidence-item.txt',
    }])),
    openBlockers: [],
    deploymentApproval: {
      decision: 'GO',
      approvedBy: 'release-owner',
      approvedAt: '2026-07-16T13:00:00Z',
    },
  }
}

test('Phase 50 signed gate accepts complete exact-commit evidence', () => {
  const result = validatePhase30Evidence(completeManifest(), {
    currentCommit: 'a'.repeat(40),
    expectedTag: 'phase50-production-20260721',
  })
  assert.equal(result.ok, true)
  assert.equal(result.passedEvidence, PHASE30_EVIDENCE_GATES.length)
})

test('Phase 50 signed gate blocks pending evidence, commit drift, and NO-GO approval', () => {
  const manifest = completeManifest()
  manifest.evidence['newsletter-test-send'].status = 'pending'
  manifest.deploymentApproval.decision = 'NO-GO'
  const result = validatePhase30Evidence(manifest, {
    currentCommit: 'b'.repeat(40),
    expectedTag: manifest.release.tag,
  })
  assert.equal(result.ok, false)
  assert.match(result.failures.join(' '), /newsletter-test-send/)
  assert.match(result.failures.join(' '), /does not match/)
  assert.match(result.failures.join(' '), /must be GO/)
})
