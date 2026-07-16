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

function commandEnvironment(target) {
  return {
    ...process.env,
    PGHOST: target.hostname,
    PGPORT: target.port,
    PGDATABASE: target.database,
    PGUSER: target.username,
    PGPASSWORD: target.password,
    ...(target.sslmode ? { PGSSLMODE: target.sslmode } : {}),
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function gitCommit(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function main() {
  const root = path.resolve(__dirname, '..', '..')
  const target = databaseTarget(process.env.DATABASE_URL)
  const confirmation = String(process.env.PHASE30_BACKUP_CONFIRM || '').trim()
  if (!target.database || !target.hostname) throw new Error('DATABASE_URL must identify the PostgreSQL target.')
  if (confirmation !== `BACK UP ${target.database}`) {
    throw new Error(`Set PHASE30_BACKUP_CONFIRM to BACK UP ${target.database}.`)
  }

  const backupDir = path.resolve(process.env.PHASE30_BACKUP_DIR || path.join(root, 'release-artifacts', 'backups'))
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(backupDir, `${target.database}-phase30-${stamp}.dump`)
  const env = commandEnvironment(target)
  const dump = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${backupFile}`], {
    stdio: 'inherit',
    env,
  })
  if (dump.error) throw dump.error
  if (dump.status !== 0) throw new Error(`pg_dump exited with status ${dump.status}.`)

  const verify = spawnSync('pg_restore', ['--list', backupFile], { stdio: 'ignore', env })
  if (verify.error) throw verify.error
  if (verify.status !== 0) throw new Error('pg_restore could not read the backup catalog.')

  const stats = fs.statSync(backupFile)
  if (!stats.size) throw new Error('The backup file is empty.')
  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    gitCommit: gitCommit(root),
    database: { hostname: target.hostname, port: target.port, name: target.database },
    backupFile,
    bytes: stats.size,
    sha256: sha256(backupFile),
    pgRestoreCatalogVerified: true,
  }
  const manifestFile = `${backupFile}.manifest.json`
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  console.log(`Phase 30 PostgreSQL backup verified: ${backupFile}`)
  console.log(`Backup manifest: ${manifestFile}`)
}

try { main() } catch (error) {
  console.error(`Phase 30 backup failed: ${error.message}`)
  process.exitCode = 1
}
