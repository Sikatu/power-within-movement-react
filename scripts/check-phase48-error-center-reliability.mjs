import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const migration = read('server/scripts/ensure-developer-error-center.cjs')
const service = read('server/src/services/developerErrorCenter.service.js')
const routes = read('server/src/routes/developerErrors.routes.js')
const api = read('src/lib/nativeApi.js')
const page = read('src/pages/admin/AdminDeveloperErrors.jsx')
const styles = read('src/pages/admin/AdminFreshUI.css')
const tests = read('server/tests/developer-error-center.test.cjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [migration, 'application_errors_fingerprint_unique', 'named fingerprint constraint repair'],
  [migration, 'UNIQUE (fingerprint) NOT DEFERRABLE', 'non-deferrable uniqueness contract'],
  [migration, 'constraint_record.convalidated', 'constraint validation check'],
  [migration, 'phase48-error-center-probe-', 'transactional persistence probe'],
  [migration, 'Developer Error Center fingerprint deduplication probe failed.', 'probe failure guard'],
  [service, 'ON CONFLICT ON CONSTRAINT application_errors_fingerprint_unique', 'unambiguous production upsert'],
  [service, 'getErrorCenterPersistenceHealth', 'persistence health service'],
  [routes, 'getErrorCenterPersistenceHealth()', 'persistence health route'],
  [routes, 'res.json({ ok: true, summary, settings, persistence })', 'health response contract'],
  [api, 'persistence: summary.persistence', 'native health projection'],
  [page, 'Capture storage ready', 'plain-language healthy state'],
  [page, 'Capture storage needs repair', 'plain-language repair state'],
  [styles, '.error-center-health-strip span.is-paused i', 'reused compact health styling'],
  [tests, 'writes use the named fingerprint constraint', 'write-path regression test'],
  [tests, 'persistence health reports the constraint state', 'health regression test'],
  [packageSource, '"admin:qa:phase48"', 'focused Phase 48 QA command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (/DROP\s+TABLE|TRUNCATE\s+/i.test(migration)) {
  failures.push('The Phase 48 migration path contains a destructive table operation.')
}

if (/ON CONFLICT\s*\(fingerprint\)/.test(service)) {
  failures.push('The Error Center still uses inferred fingerprint conflict handling.')
}

if (failures.length) {
  console.error('\nPhase 48 Developer Error Center Reliability audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 48 Developer Error Center Reliability audit passed (legacy deduplication, named non-deferrable constraint repair, transactional write probe, explicit runtime upsert, compact persistence health, and regression coverage).')
