const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const temporaryRoot = path.join(os.tmpdir(), `pwc-asset-vault-${process.pid}`)
process.env.ASSET_STORAGE_DRIVER = 'local'
process.env.ASSET_STORAGE_DIR = temporaryRoot
process.env.ASSET_MAX_UPLOAD_BYTES = String(1024 * 1024)

const {
  canPreviewAsset,
  deleteObject,
  readObject,
  safeSegment,
  validateUpload,
  writeUploadedAsset,
} = require('../src/services/assetStorage.service')
const {
  createSignedGrant,
  hashGrantToken,
  verifySignedGrant,
} = require('../src/services/assetAccessGrant.service')
const {
  assertAssetUsable,
  getInitialScanState,
  isAssetUsable,
} = require('../src/services/assetScan.service')

test('asset filename sanitizer removes unsafe path characters', () => {
  assert.equal(safeSegment('../../Client Notes July.pdf'), '..-..-Client-Notes-July.pdf')
  assert.equal(safeSegment(''), 'file')
})

test('asset upload validation permits supported private files', () => {
  const result = validateUpload({ fileName: 'guide.pdf', mimeType: 'application/pdf', sizeBytes: 1200 })
  assert.equal(result.ok, true)
  assert.equal(result.mimeType, 'application/pdf')
})

test('asset upload validation blocks unsupported and oversized files', () => {
  const unsupported = validateUpload({ fileName: 'script.exe', mimeType: 'application/x-msdownload', sizeBytes: 100 })
  assert.equal(unsupported.ok, false)
  assert.match(unsupported.errors.join(' '), /not supported/i)

  const oversized = validateUpload({ fileName: 'large.pdf', mimeType: 'application/pdf', sizeBytes: 2 * 1024 * 1024 })
  assert.equal(oversized.ok, false)
  assert.match(oversized.errors.join(' '), /upload limit/i)
})

test('Asset Vault preview policy allows safe browser formats only', () => {
  assert.equal(canPreviewAsset({ mime_type: 'application/pdf' }), true)
  assert.equal(canPreviewAsset({ mime_type: 'image/png' }), true)
  assert.equal(canPreviewAsset({ mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), false)
})

test('short-lived asset grants verify scope, signature, and expiry', () => {
  const now = new Date('2026-07-16T00:00:00.000Z')
  const grant = createSignedGrant({
    grantId: 'grant-test-id',
    assetId: 'asset-test-id',
    actorUserId: 'developer-test-id',
    purpose: 'preview',
    ttlSeconds: 60,
    secret: 'phase-26r2-test-secret',
    now,
  })

  assert.equal(hashGrantToken(grant.token).length, 64)
  assert.equal(verifySignedGrant(grant.token, { secret: 'phase-26r2-test-secret', purpose: 'preview', now }).assetId, 'asset-test-id')
  assert.throws(() => verifySignedGrant(grant.token, { secret: 'wrong-secret', now }), /invalid or expired/i)
  assert.throws(() => verifySignedGrant(grant.token, { secret: 'phase-26r2-test-secret', purpose: 'download', now }), /cannot be used/i)
  assert.throws(() => verifySignedGrant(grant.token, { secret: 'phase-26r2-test-secret', now: new Date('2026-07-16T00:01:01.000Z') }), /expired/i)
})

test('asset grant redemption query avoids PostgreSQL reserved aliases', async () => {
  const routeSource = await fs.readFile(
    path.join(__dirname, '..', 'src', 'routes', 'assetVault.routes.js'),
    'utf8',
  )

  assert.match(routeSource, /FROM asset_access_grants AS access_grant/)
  assert.match(routeSource, /FOR UPDATE OF access_grant/)
  assert.doesNotMatch(routeSource, /asset_access_grants\s+grant\b/)
  assert.doesNotMatch(routeSource, /\bgrant\.\*/)
})

test('asset scan abstraction is truthful and gates unsafe states', () => {
  const disabled = getInitialScanState('disabled')
  const configured = getInitialScanState('clamav')
  assert.equal(disabled.status, 'disabled')
  assert.match(disabled.message, /not configured/i)
  assert.equal(configured.status, 'pending')
  assert.equal(isAssetUsable({ status: 'active', scan_status: 'clean' }), true)
  assert.equal(isAssetUsable({ status: 'active', scan_status: 'pending' }), false)
  assert.doesNotThrow(() => assertAssetUsable({ status: 'active', scan_status: 'disabled' }))
  assert.throws(() => assertAssetUsable({ status: 'active', scan_status: 'blocked' }), /blocked/i)
})

test('local asset adapter writes, reads, verifies, and deletes private content', async () => {
  const input = Buffer.from('Power Within private asset test')
  const stored = await writeUploadedAsset({ fileName: 'private-note.txt', mimeType: 'text/plain', buffer: input })
  assert.equal(stored.storageDriver, 'local')
  assert.equal(stored.sizeBytes, input.length)
  assert.equal(stored.checksumSha256.length, 64)

  const output = await readObject(stored)
  assert.deepEqual(output, input)

  await deleteObject(stored)
  await assert.rejects(() => readObject(stored), /ENOENT/)
})

test.after(async () => {
  await fs.rm(temporaryRoot, { recursive: true, force: true })
})

const { buildBulkAssignmentPlan } = require('../src/services/assetAssignment.service')

test('bulk Asset Vault assignment skips active client resources and repairs pending access', () => {
  const plan = buildBulkAssignmentPlan({
    clientIds: ['client-a', 'client-a', 'client-b', 'client-c'],
    existingAssignments: [
      { id: 'assignment-a', client_profile_id: 'client-a', status: 'active', portal_resource_id: 'resource-a' },
      { id: 'assignment-b', client_profile_id: 'client-b', status: 'revoked', portal_resource_id: 'resource-b' },
    ],
  })

  assert.equal(plan.eligibleCount, 3)
  assert.deepEqual(plan.alreadyAssigned.map((entry) => entry.clientProfileId), ['client-a'])
  assert.deepEqual(plan.pending.map((entry) => entry.clientProfileId), ['client-b', 'client-c'])
  assert.equal(plan.pending[0].existing.id, 'assignment-b')
})

test('bulk Asset Vault assignment repairs active rows that lost their portal resource', () => {
  const plan = buildBulkAssignmentPlan({
    clientIds: ['client-a'],
    existingAssignments: [
      { id: 'assignment-a', client_profile_id: 'client-a', status: 'active', portal_resource_id: null },
    ],
  })

  assert.equal(plan.alreadyAssigned.length, 0)
  assert.equal(plan.pending.length, 1)
  assert.equal(plan.pending[0].existing.id, 'assignment-a')
})
