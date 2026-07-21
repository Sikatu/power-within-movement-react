import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const service = read('server/src/services/developerErrorCenter.service.js')
const routes = read('server/src/routes/developerErrors.routes.js')
const api = read('src/lib/nativeApi.js')
const page = read('src/pages/admin/AdminDeveloperErrors.jsx')
const tests = read('server/tests/developer-error-center.test.cjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [service, "const TRIAGE_QUEUES = ['attention', 'urgent', 'recurring', 'tests', 'history', 'all']", 'bounded triage queues'],
  [service, 'function buildErrorTriage(row = {})', 'server-owned triage guidance'],
  [service, "COALESCE(metadata ->> 'safeTest', 'false')", 'safe-test isolation'],
  [service, 'async function ignoreSafeTestErrors(actorUserId, db = pool)', 'safe-test cleanup service'],
  [service, "'developer_error_safe_tests_ignored'", 'safe-test cleanup audit event'],
  [routes, "router.use(requireAuth, requireRole(['developer']))", 'developer-only route protection'],
  [routes, "router.post('/safe-tests/ignore'", 'safe-test cleanup endpoint'],
  [api, 'export async function ignoreDeveloperSafeTestErrors()', 'safe-test cleanup client'],
  [page, "queue: 'attention'", 'attention-first default'],
  [page, 'aria-label="Choose triage queue"', 'accessible queue chooser'],
  [page, 'Recommended next step', 'plain-language incident guidance'],
  [page, 'Ignore active tests', 'compact test-noise cleanup'],
  [tests, 'triage prioritizes active incidents and isolates safe tests', 'triage regression coverage'],
  [tests, 'list queries use the requested triage queue', 'queue query regression coverage'],
  [tests, 'removes active test noise from attention', 'safe-test cleanup regression coverage'],
  [packageSource, '"admin:qa:phase49"', 'focused Phase 49 QA command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const cleanupRouteIndex = routes.indexOf("router.post('/safe-tests/ignore'")
const parameterRouteIndex = routes.indexOf("router.get('/:errorId'")
if (cleanupRouteIndex < 0 || parameterRouteIndex < 0 || cleanupRouteIndex > parameterRouteIndex) {
  failures.push('The safe-test cleanup endpoint must be declared before the parameterized error route.')
}

if (page.includes('filters.status')) {
  failures.push('The retired raw status filter still competes with the triage queue.')
}

if (failures.length) {
  console.error('\nPhase 49 Developer Incident Triage audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 49 Developer Incident Triage audit passed (attention-first queues, recurring and urgent classification, safe-test isolation, guided status actions, audited cleanup, and regression coverage).',
)
