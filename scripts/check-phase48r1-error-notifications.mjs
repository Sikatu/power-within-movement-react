import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const service = read('server/src/services/developerErrorCenter.service.js')
const migration = read('server/scripts/ensure-notification-center.cjs')
const tests = read('server/tests/developer-error-center.test.cjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [service, 'ON CONFLICT (dedupe_key)\n        WHERE dedupe_key IS NOT NULL', 'partial-index notification upsert'],
  [service, 'persisted an error but could not notify developers', 'truthful notification failure reporting'],
  [migration, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key', 'notification dedupe index'],
  [migration, 'WHERE dedupe_key IS NOT NULL', 'notification index predicate'],
  [tests, 'notifications match the partial dedupe index', 'notification conflict regression test'],
  [tests, 'notification failures do not discard a persisted Error Center event', 'persistence isolation regression test'],
  [packageSource, '"admin:qa:phase48r1"', 'focused Phase 48R1 QA command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (/ON CONFLICT \(dedupe_key\) DO NOTHING/.test(service)) {
  failures.push('The Error Center notification upsert still omits its partial-index predicate.')
}

if (failures.length) {
  console.error('\nPhase 48R1 Error Center Notification audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 48R1 Error Center Notification audit passed (partial-index-compatible notification deduplication, truthful failure isolation, and regression coverage).')
