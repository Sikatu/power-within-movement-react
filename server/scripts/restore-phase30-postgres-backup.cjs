const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

function databaseTarget(value) {
  const parsed = new URL(String(value || ''))
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('PostgreSQL URL required.')
  return {
    hostname: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    sslmode: parsed.searchParams.get('sslmode') || '',
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function main() {
  const execute = process.argv.includes('--execute')
  const manifestArg = process.argv.find((value, index) => index > 1 && value !== '--execute')
  const manifestPath = path.resolve(manifestArg || process.env.PHASE30_BACKUP_MANIFEST || '')
  if (!manifestArg && !process.env.PHASE30_BACKUP_MANIFEST) throw new Error('Pass the verified backup manifest path.')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const backupFile = path.resolve(manifest.backupFile || '')
  const target = databaseTarget(process.env.DATABASE_URL)
  if (manifest.database?.name !== target.database) throw new Error('Backup and restore database names do not match.')
  if (!fs.statSync(backupFile).size || sha256(backupFile) !== manifest.sha256) {
    throw new Error('Backup checksum verification failed.')
  }

  const confirmation = `RESTORE ${target.database} FROM ${manifest.sha256.slice(0, 12)}`
  console.log(`Phase 30 database restore target: ${target.database} at ${target.hostname}`)
  console.log(`Verified backup SHA-256: ${manifest.sha256}`)
  if (!execute) {
    console.log('Preview only. Database contents were not changed.')
    console.log(`Execution additionally requires PHASE30_DATABASE_RESTORE_CONFIRM="${confirmation}".`)
    return
  }
  if (process.env.PHASE30_ALLOW_DATABASE_RESTORE !== 'true') {
    throw new Error('Set PHASE30_ALLOW_DATABASE_RESTORE=true for an approved restore window.')
  }
  if (String(process.env.PHASE30_DATABASE_RESTORE_CONFIRM || '').trim() !== confirmation) {
    throw new Error(`Set PHASE30_DATABASE_RESTORE_CONFIRM to ${confirmation}.`)
  }

  const env = {
    ...process.env,
    PGHOST: target.hostname,
    PGPORT: target.port,
    PGDATABASE: target.database,
    PGUSER: target.username,
    PGPASSWORD: target.password,
    ...(target.sslmode ? { PGSSLMODE: target.sslmode } : {}),
  }
  const restore = spawnSync('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    '--single-transaction',
    `--dbname=${target.database}`,
    backupFile,
  ], { stdio: 'inherit', env })
  if (restore.error) throw restore.error
  if (restore.status !== 0) throw new Error(`pg_restore exited with status ${restore.status}.`)
  console.log('Phase 30 PostgreSQL restore completed. Run migrations and the full post-rollback verification matrix now.')
}

try { main() } catch (error) {
  console.error(`Phase 30 database restore refused or failed: ${error.message}`)
  process.exitCode = 1
}
