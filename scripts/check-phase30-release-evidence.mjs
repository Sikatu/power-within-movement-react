import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { validatePhase30Evidence } from './lib/phase30ReleaseGate.mjs'

const evidencePath = resolve(
  process.argv[2]
    || process.env.PWC_RELEASE_EVIDENCE_FILE
    || process.env.PWC_PHASE30_EVIDENCE_FILE
    || '',
)
const expectedTag = String(process.env.PWC_RELEASE_TAG || '').trim()

if (!process.argv[2] && !process.env.PWC_RELEASE_EVIDENCE_FILE && !process.env.PWC_PHASE30_EVIDENCE_FILE) {
  console.error('Set PWC_RELEASE_EVIDENCE_FILE or pass the signed evidence JSON path.')
  process.exit(2)
}

const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })
if (commitResult.status !== 0) {
  console.error('Unable to resolve the checked-out Git commit.')
  process.exit(2)
}

if (expectedTag) {
  const tagResult = spawnSync('git', ['rev-list', '-n', '1', expectedTag], { encoding: 'utf8' })
  if (tagResult.status !== 0 || tagResult.stdout.trim() !== commitResult.stdout.trim()) {
    console.error(`Release tag ${expectedTag} does not point to the checked-out commit.`)
    process.exit(2)
  }
}

try {
  const manifest = JSON.parse(await readFile(evidencePath, 'utf8'))
  const result = validatePhase30Evidence(manifest, {
    currentCommit: commitResult.stdout.trim(),
    expectedTag,
  })

  if (!result.ok) {
    console.error('\nPhase 50 signed release-candidate gate is BLOCKED:\n')
    for (const failure of result.failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`Phase 50 signed release-candidate gate passed (${result.passedEvidence}/${result.totalEvidence} evidence items).`)
} catch (error) {
  console.error(`Unable to validate Phase 50 evidence: ${error.message}`)
  process.exit(2)
}
