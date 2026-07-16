const { spawnSync } = require('child_process')
const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

function target(value) {
  const parsed = new URL(String(value || ''))
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('PostgreSQL URL required.')
  return {
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, '').toLowerCase(),
  }
}

function sameDatabase(left, right) {
  if (!left || !right) return false
  try {
    const a = target(left)
    const b = target(right)
    return a.hostname === b.hostname && a.port === b.port && a.database === b.database
  } catch {
    return String(left) === String(right)
  }
}

function validateRehearsalTarget({ rehearsalUrl, productionUrl, confirmation }) {
  const failures = []
  let rehearsal
  try { rehearsal = target(rehearsalUrl) } catch { failures.push('PHASE30_REHEARSAL_DATABASE_URL must be a valid PostgreSQL URL.') }
  if (rehearsal && !rehearsal.database) failures.push('The rehearsal database name is missing.')
  if (sameDatabase(rehearsalUrl, productionUrl)) failures.push('The rehearsal target matches DATABASE_URL; production rehearsal is forbidden.')
  if (rehearsal && confirmation !== `RUN ISOLATED REHEARSAL ${rehearsal.database}`) {
    failures.push(`Set PHASE30_REHEARSAL_CONFIRM to RUN ISOLATED REHEARSAL ${rehearsal.database}.`)
  }
  return { ok: failures.length === 0, failures, rehearsal }
}

function main() {
  const rehearsalUrl = String(process.env.PHASE30_REHEARSAL_DATABASE_URL || '').trim()
  const result = validateRehearsalTarget({
    rehearsalUrl,
    productionUrl: String(process.env.DATABASE_URL || '').trim(),
    confirmation: String(process.env.PHASE30_REHEARSAL_CONFIRM || '').trim(),
  })

  if (!result.ok) {
    console.error('\nPhase 30 migration rehearsal refused:\n')
    for (const failure of result.failures) console.error(`- ${failure}`)
    process.exit(2)
  }

  console.log(`Running ordered migrations on isolated database ${result.rehearsal.database} at ${result.rehearsal.hostname}.`)
  const child = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'db:migrate:ordered'],
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: rehearsalUrl,
        NODE_ENV: 'development',
      },
    },
  )
  if (child.error) throw child.error
  if (child.status !== 0) process.exit(child.status || 1)
  console.log('Phase 30 isolated migration rehearsal passed. Retain this output with the release evidence.')
}

if (require.main === module) {
  try { main() } catch (error) {
    console.error(`Phase 30 migration rehearsal failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { sameDatabase, target, validateRehearsalTarget }
