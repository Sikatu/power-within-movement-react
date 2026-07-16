const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function main() {
  const manifestPath = path.resolve(process.argv[2] || process.env.PHASE30_BACKUP_MANIFEST || '')
  if (!process.argv[2] && !process.env.PHASE30_BACKUP_MANIFEST) {
    throw new Error('Pass a backup manifest path or set PHASE30_BACKUP_MANIFEST.')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (!manifest.backupFile || !manifest.sha256 || !manifest.pgRestoreCatalogVerified) {
    throw new Error('The backup manifest is incomplete.')
  }
  const backupFile = path.resolve(manifest.backupFile)
  const stats = fs.statSync(backupFile)
  if (!stats.size || stats.size !== manifest.bytes) throw new Error('Backup size does not match its manifest.')
  if (sha256(backupFile) !== manifest.sha256) throw new Error('Backup checksum does not match its manifest.')
  const verify = spawnSync('pg_restore', ['--list', backupFile], { stdio: 'ignore' })
  if (verify.error) throw verify.error
  if (verify.status !== 0) throw new Error('pg_restore could not read the backup catalog.')
  console.log(`Phase 30 PostgreSQL backup verified (${stats.size} bytes, SHA-256 ${manifest.sha256}).`)
}

try { main() } catch (error) {
  console.error(`Phase 30 backup verification failed: ${error.message}`)
  process.exitCode = 1
}
