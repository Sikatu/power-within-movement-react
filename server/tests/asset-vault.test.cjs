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
  deleteObject,
  readObject,
  safeSegment,
  validateUpload,
  writeUploadedAsset,
} = require('../src/services/assetStorage.service')

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
