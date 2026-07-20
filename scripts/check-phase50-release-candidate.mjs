import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { PHASE30_EVIDENCE_GATES } from '../src/components/admin/adminReleaseQa.js'

const require = createRequire(import.meta.url)
const readiness = require('../server/src/services/releaseReadiness.service.js')
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const service = read('server/src/services/releaseReadiness.service.js')
const page = read('src/pages/admin/AdminReleaseQa.jsx')
const contracts = read('src/components/admin/adminReleaseQa.js')
const gate = read('scripts/lib/phase30ReleaseGate.mjs')
const gateRunner = read('scripts/check-phase30-release-evidence.mjs')
const deploy = read('ops/phase30/deploy-production.sh')
const tests = read('server/tests/phase30-release-readiness.test.cjs')
const packageSource = read('package.json')
const docs = read('docs/phase50-final-release-candidate.md')
const evidenceExample = JSON.parse(read('ops/phase30/release-evidence.example.json'))
const failures = []

const requirements = [
  [service, 'const RELEASE_CANDIDATE_PHASE = 50', 'final candidate version'],
  [service, 'RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS', 'persistence constraint gate'],
  [service, 'RELEASE_CANDIDATE_REQUIRED_INDEXES', 'deduplication index gate'],
  [service, "'application_errors_fingerprint_unique'", 'Error Center fingerprint invariant'],
  [service, "'idx_notifications_dedupe_key'", 'notification dedupe invariant'],
  [service, 'studioProfileCount', 'primary Studio Profile gate'],
  [page, 'Phase 50 · Final Release Candidate', 'final candidate workspace label'],
  [page, "'pwc.phase50.release-evidence.v1'", 'fresh Phase 50 browser evidence ledger'],
  [contracts, "endpoint: '/api/admin/studio-profile'", 'Studio Profile live contract'],
  [contracts, "endpoint: '/api/admin/notifications/summary'", 'Notification Center live contract'],
  [contracts, "endpoint: '/api/admin/developer/errors/summary'", 'incident triage live contract'],
  [contracts, "id: 'notification-delivery'", 'notification delivery evidence'],
  [contracts, "id: 'client-messaging'", 'client messaging evidence'],
  [contracts, "id: 'studio-identity'", 'Studio identity evidence'],
  [contracts, "id: 'incident-triage'", 'incident triage evidence'],
  [gate, "manifest?.phase !== 50", 'Phase 50 signed manifest contract'],
  [gateRunner, 'PWC_RELEASE_EVIDENCE_FILE', 'current release evidence variable'],
  [deploy, 'npm run admin:qa:phase50', 'Phase 50 production QA'],
  [tests, 'complete release-candidate foundation', 'complete schema regression coverage'],
  [tests, 'missing persistence invariants', 'invariant regression coverage'],
  [packageSource, '"admin:qa:phase50"', 'focused Phase 50 QA command'],
  [packageSource, '"release:candidate:gate"', 'signed candidate gate command'],
  [docs, 'feature finish line', 'honest finalization boundary'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const requiredTables = readiness.RELEASE_CANDIDATE_REQUIRED_TABLES || []
for (const tableName of [
  'application_errors',
  'client_conversations',
  'notifications',
  'notification_preferences',
  'studio_profiles',
]) {
  if (!requiredTables.includes(tableName)) failures.push(`final schema gate omits ${tableName}`)
}
if (requiredTables.length < 70 || new Set(requiredTables).size !== requiredTables.length) {
  failures.push('The final schema gate must contain at least 70 unique feature tables.')
}

if (evidenceExample.phase !== 50) failures.push('The release evidence example is not Phase 50.')
for (const gateItem of PHASE30_EVIDENCE_GATES) {
  if (!evidenceExample.evidence?.[gateItem.id]) {
    failures.push(`The release evidence example omits ${gateItem.id}.`)
  }
}

if (page.includes('Phase 30 · Integrated Release QA')) {
  failures.push('The Release Gate still exposes the retired Phase 30 workspace label.')
}

if (failures.length) {
  console.error('\nPhase 50 Final Release Candidate audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Phase 50 Final Release Candidate audit passed (${requiredTables.length} required tables, ${PHASE30_EVIDENCE_GATES.length} signed evidence gates, current persistence invariants, 3 post-Phase-30 live contracts, and production deployment alignment).`,
)
